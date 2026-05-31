// AnchorContextEngine — the production strategy used by Ares since the
// long-run survival pass. Keeps "anchor" messages verbatim and collapses
// "filler" runs into <context_summary> synthetic turns. Pressure-aware:
// at higher pressure, fewer messages qualify as anchors.
//
// Anchors (preserve verbatim):
//   - The most recent N user turns (N depends on pressure: 4 / 2 / 1)
//   - Assistant turns whose total text content exceeds an
//     assistantTextThreshold (800 / 2000 / 5000 chars by pressure)
//   - Assistant turns containing durable-artefact tool calls
//     (fs_write, email_draft, memory_record, skill_save, ticketing writes…)
//   - Assistant turns whose matching tool_result is "big enough"
//     (toolResultThreshold = 2KB / 8KB / 32KB by pressure)
//
// Filler runs become a single synthetic message with a <context_summary>
// payload listing 160-char-truncated user/assistant snippets and tool names.
//
// Behaviour MUST stay identical to the inlined logic that previously lived
// in lib/agent.js — the test suite at tests/context.test.js locks this in.

import { ContextEngine } from "./base.js";

const DURABLE_PATTERNS = [
  /fs_write/i,
  /email_draft/i,
  /email_reply/i,
  /memory_record/i,
  /skill_save/i,
  /TicketingWriteActions/i,
  /CreateSubscription/i,
  /CreateAccessRequest/i,
];

// ─── Token budgeting ───────────────────────────────────────────────────────
// 200K Bedrock window. Real prompt overhead with 3 on-demand MCPs active is
// ~103K tokens (system prompt + tool schemas + RAG block). We reserve 115K
// to keep a 12K cushion. That leaves 85K for the transcript, with soft
// compression at 65K transcript (175K total) and hard truncate at 80K
// (195K total). Conservative on purpose — a 200K rejection wastes the
// whole round-trip.
const TOKEN_OVERHEAD_RESERVED = 115000;
const TOKEN_BEDROCK_MAX = 200000;
const TOKEN_BEDROCK_SAFE_MAX = 195000;
const TOKEN_SOFT_LIMIT = TOKEN_BEDROCK_MAX - TOKEN_OVERHEAD_RESERVED - 20000; // 65K
const TOKEN_HARD_LIMIT = TOKEN_BEDROCK_MAX - TOKEN_OVERHEAD_RESERVED - 5000;  // 80K

// Per-tool-result block cap. Anything bigger gets head+tail truncated with a
// marker. 8 KB ≈ 2K tokens — well under our budget headroom.
const TOOL_RESULT_MAX_CHARS = 8 * 1024;
const TOOL_RESULT_HEAD_CHARS = 4 * 1024;
const TOOL_RESULT_TAIL_CHARS = 2 * 1024;

const MAX_MESSAGES_BEFORE_COMPRESS = 60;
const KEEP_RECENT_MESSAGES = 8;

export class AnchorContextEngine extends ContextEngine {
  get name() { return "anchor"; }

  get limits() {
    return {
      bedrockMax: TOKEN_BEDROCK_MAX,
      bedrockSafeMax: TOKEN_BEDROCK_SAFE_MAX,
      soft: TOKEN_SOFT_LIMIT,
      hard: TOKEN_HARD_LIMIT,
      maxMessages: MAX_MESSAGES_BEFORE_COMPRESS,
      keepRecent: KEEP_RECENT_MESSAGES,
      toolResultMaxChars: TOOL_RESULT_MAX_CHARS,
    };
  }

  shouldCompress(messages, ctx = {}) {
    const tokens = ctx.tokens != null ? ctx.tokens : this.estimateTokens(messages);
    return messages.length > MAX_MESSAGES_BEFORE_COMPRESS || tokens > TOKEN_SOFT_LIMIT;
  }

  /**
   * Token estimate for the message transcript only. 2.6 chars/tok. Block-
   * wrapper overhead (~40 chars per content block) is added in. NOTE: this
   * counts the TRANSCRIPT only — the system prompt (~25K tokens) and tool
   * schemas (~1K per active MCP) are accounted for separately via the
   * 115K reserved overhead.
   */
  estimateTokens(messages) {
    const CHARS_PER_TOKEN = 2.6;
    const PER_BLOCK_OVERHEAD = 40;
    let chars = 0;
    for (const m of messages) {
      if (!m) continue;
      chars += 24; // wrapper around every message
      if (typeof m.content === "string") {
        chars += m.content.length;
        continue;
      }
      if (!Array.isArray(m.content)) continue;
      for (const b of m.content) {
        chars += PER_BLOCK_OVERHEAD;
        if (b.type === "text" && typeof b.text === "string") {
          chars += b.text.length;
        } else if (b.type === "tool_use") {
          chars += (b.name?.length || 0) + (b.id?.length || 0);
          try { chars += JSON.stringify(b.input || {}).length; } catch {}
        } else if (b.type === "tool_result") {
          chars += (b.tool_use_id?.length || 0);
          if (typeof b.content === "string") {
            chars += b.content.length;
          } else if (Array.isArray(b.content)) {
            for (const c of b.content) {
              if (typeof c?.text === "string") chars += c.text.length;
            }
          }
        }
      }
    }
    return Math.ceil(chars / CHARS_PER_TOKEN);
  }

  /**
   * Truncate any large block — tool_result OR text — that exceeds the size
   * cap. Pasted file attachments arrive as <file>…</file>-wrapped text in
   * USER messages and were not previously truncated; a single 6 MB CSV in
   * a text block was bypassing the budget guard entirely.
   *
   * Keeps head + tail and drops the middle so agents still see orientation
   * cues — file headers, error traces, summary lines.
   */
  truncateLargeToolResults(messages) {
    const truncOne = (text) => {
      if (text.length <= TOOL_RESULT_MAX_CHARS) return text;
      const head = text.slice(0, TOOL_RESULT_HEAD_CHARS);
      const tail = text.slice(-TOOL_RESULT_TAIL_CHARS);
      const dropped = text.length - TOOL_RESULT_HEAD_CHARS - TOOL_RESULT_TAIL_CHARS;
      return `${head}\n\n... [truncated ${dropped.toLocaleString()} chars; head+tail kept] ...\n\n${tail}`;
    };
    return messages.map((m) => {
      if (!m || !Array.isArray(m.content)) return m;
      let mutated = false;
      const newContent = m.content.map((b) => {
        if (b.type === "text" && typeof b.text === "string") {
          if (b.text.length <= TOOL_RESULT_MAX_CHARS) return b;
          mutated = true;
          return { ...b, text: truncOne(b.text) };
        }
        if (b.type === "tool_result") {
          if (typeof b.content === "string") {
            if (b.content.length <= TOOL_RESULT_MAX_CHARS) return b;
            mutated = true;
            return { ...b, content: truncOne(b.content) };
          }
          if (Array.isArray(b.content)) {
            let blockMutated = false;
            const newBlocks = b.content.map((c) => {
              if (typeof c?.text !== "string") return c;
              if (c.text.length <= TOOL_RESULT_MAX_CHARS) return c;
              blockMutated = true;
              return { ...c, text: truncOne(c.text) };
            });
            if (blockMutated) {
              mutated = true;
              return { ...b, content: newBlocks };
            }
          }
        }
        return b;
      });
      return mutated ? { ...m, content: newContent } : m;
    });
  }

  _classifyMessage(m, allMessages, idx, options = {}) {
    if (!m) return "filler";
    const {
      recentUserAnchorIdxs = null,
      toolResultThreshold = 2048,
      assistantTextThreshold = 800,
    } = options;

    if (m.role === "user") {
      if (recentUserAnchorIdxs) {
        return recentUserAnchorIdxs.has(idx) ? "anchor" : "filler";
      }
      return "anchor";
    }
    if (m.role !== "assistant" || !Array.isArray(m.content)) return "filler";

    const totalTextLen = m.content
      .filter((b) => b.type === "text")
      .reduce((n, b) => n + (b.text?.length || 0), 0);
    if (totalTextLen > assistantTextThreshold) return "anchor";

    for (const b of m.content) {
      if (b.type === "tool_use" && b.name) {
        for (const p of DURABLE_PATTERNS) {
          if (p.test(b.name)) return "anchor";
        }
      }
    }

    const next = allMessages[idx + 1];
    if (next && next.role === "user" && Array.isArray(next.content)) {
      const toolIds = new Set(
        m.content.filter((b) => b.type === "tool_use" && b.id).map((b) => b.id)
      );
      for (const b of next.content) {
        if (b.type === "tool_result" && toolIds.has(b.tool_use_id)) {
          const resText = typeof b.content === "string"
            ? b.content
            : Array.isArray(b.content)
              ? b.content.map((c) => c.text || "").join("")
              : "";
          if (resText.length > toolResultThreshold) return "anchor";
        }
      }
    }

    return "filler";
  }

  /**
   * Compress older messages into a summary while preserving anchor messages
   * verbatim. Pressure 0 = first pass, 1 = retry, 2 = aggressive.
   *
   * Strategy:
   *   1. Keep the last KEEP_RECENT_MESSAGES intact (recency).
   *   2. Walk the older portion, classifying each message anchor|filler.
   *   3. Anchors are kept verbatim. Filler runs collapse into a single
   *      synthetic user/assistant turn carrying a <context_summary> block.
   *   4. tool_result blocks matching a kept assistant tool_use survive
   *      alongside it so the Bedrock invariant holds.
   */
  compress(messages, options = {}) {
    const { pressure = 0 } = options;

    if (messages.length <= MAX_MESSAGES_BEFORE_COMPRESS && pressure === 0) {
      return messages;
    }

    const tailStart = Math.max(0, messages.length - KEEP_RECENT_MESSAGES);
    const toClassify = messages.slice(0, tailStart);
    const toKeep = messages.slice(tailStart);

    const recentUserKeep = pressure >= 2 ? 1 : pressure >= 1 ? 2 : 4;
    const userIdxs = [];
    for (let i = 0; i < toClassify.length; i++) {
      if (toClassify[i]?.role === "user") userIdxs.push(i);
    }
    const recentUserAnchorIdxs = new Set(userIdxs.slice(-recentUserKeep));
    const toolResultThreshold = pressure >= 2 ? 32768 : pressure >= 1 ? 8192 : 2048;
    const assistantTextThreshold = pressure >= 2 ? 5000 : pressure >= 1 ? 2000 : 800;

    const kinds = toClassify.map((m, i) => this._classifyMessage(m, messages, i, {
      recentUserAnchorIdxs,
      toolResultThreshold,
      assistantTextThreshold,
    }));

    const compressed = [];
    let fillerRun = [];
    const flushFillerRun = () => {
      if (!fillerRun.length) return;
      const bits = [];
      for (const m of fillerRun) {
        if (m.role === "user") {
          const text = Array.isArray(m.content)
            ? m.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").slice(0, 160)
            : (typeof m.content === "string" ? m.content.slice(0, 160) : "");
          if (text) bits.push(`User: ${text}`);
        } else if (m.role === "assistant") {
          const text = Array.isArray(m.content)
            ? m.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").slice(0, 160)
            : "";
          const tools = Array.isArray(m.content)
            ? m.content.filter((b) => b.type === "tool_use").map((b) => b.name)
            : [];
          if (text) bits.push(`Assistant: ${text}`);
          if (tools.length) bits.push(`  [tools: ${tools.join(", ")}]`);
        }
      }
      if (bits.length) {
        const last = compressed[compressed.length - 1];
        const role = last?.role === "user" ? "assistant" : "user";
        compressed.push({
          role,
          content: [{
            type: "text",
            text: `<context_summary pressure="${pressure}" compressed="${fillerRun.length}">\n${bits.join("\n").slice(0, 3000)}\n</context_summary>`,
          }],
        });
      }
      fillerRun = [];
    };

    for (let i = 0; i < toClassify.length; i++) {
      const m = toClassify[i];
      if (kinds[i] === "anchor") {
        flushFillerRun();
        compressed.push(m);
        if (m.role === "assistant" && Array.isArray(m.content)) {
          const toolIds = new Set(
            m.content.filter((b) => b.type === "tool_use" && b.id).map((b) => b.id)
          );
          if (toolIds.size && i + 1 < toClassify.length) {
            const next = toClassify[i + 1];
            if (next && next.role === "user" && Array.isArray(next.content)) {
              const hasMatching = next.content.some(
                (b) => b.type === "tool_result" && toolIds.has(b.tool_use_id)
              );
              if (hasMatching) {
                compressed.push(next);
                kinds[i + 1] = "__consumed__";
              }
            }
          }
        }
      } else if (kinds[i] === "__consumed__") {
        // already pushed alongside a previous assistant anchor
      } else {
        fillerRun.push(m);
      }
    }
    flushFillerRun();

    return [...compressed, ...toKeep];
  }

  /**
   * Hard-truncate fallback — used only when iterative compression at max
   * pressure still leaves us above TOKEN_HARD_LIMIT. Keeps the first user
   * message (original task intent) + the last KEEP_RECENT_MESSAGES, drops
   * everything in between with a single summary marker. After this the
   * caller will re-sanitize so any orphan tool_result blocks get repaired.
   */
  hardTruncate(messages) {
    if (messages.length <= KEEP_RECENT_MESSAGES + 1) return messages;
    const head = messages.slice(0, 1);
    const tail = messages.slice(-KEEP_RECENT_MESSAGES);
    const marker = {
      role: "assistant",
      content: [{
        type: "text",
        text: `<context_summary truncated="hard">\nDropped ${messages.length - 1 - KEEP_RECENT_MESSAGES} mid-conversation messages to fit the model's input window. Earliest user intent and the most recent ${KEEP_RECENT_MESSAGES} messages are preserved verbatim.\n</context_summary>`,
      }],
    };
    return [...head, marker, ...tail];
  }
}
