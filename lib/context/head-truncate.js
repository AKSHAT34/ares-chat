// HeadTruncateContextEngine — simpler baseline strategy.
//
// Keeps the first user turn + the last K messages, drops the middle into a
// single <context_summary truncated="hard"> marker. NO anchor classification,
// NO durable-artefact preservation, NO pressure levels. The agent gets the
// same {originalCount, compressedCount} event shape on the SSE stream so
// the UI doesn't need to care which engine ran.
//
// Why ship this? Two reasons:
//   1. It's a cheap reference baseline — when AnchorContextEngine misbehaves
//      ("why did my last user turn vanish?") we can A/B against this engine
//      to confirm the problem is anchor-classification-specific.
//   2. Hermes' canonical engine is anchor-aware; having a non-anchor engine
//      keeps the ABC honest. If we ever add a third engine (token-quota,
//      semantic-summary, …) the interface won't surprise us.

import { ContextEngine } from "./base.js";

const MAX_MESSAGES_BEFORE_COMPRESS = 60;
const KEEP_RECENT_MESSAGES = 8;
const TOKEN_OVERHEAD_RESERVED = 115000;
const TOKEN_BEDROCK_MAX = 200000;
const TOKEN_BEDROCK_SAFE_MAX = 195000;
const TOKEN_SOFT_LIMIT = TOKEN_BEDROCK_MAX - TOKEN_OVERHEAD_RESERVED - 20000;
const TOKEN_HARD_LIMIT = TOKEN_BEDROCK_MAX - TOKEN_OVERHEAD_RESERVED - 5000;
const TOOL_RESULT_MAX_CHARS = 8 * 1024;
const TOOL_RESULT_HEAD_CHARS = 4 * 1024;
const TOOL_RESULT_TAIL_CHARS = 2 * 1024;

export class HeadTruncateContextEngine extends ContextEngine {
  get name() { return "head-truncate"; }

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

  estimateTokens(messages) {
    const CHARS_PER_TOKEN = 2.6;
    const PER_BLOCK_OVERHEAD = 40;
    let chars = 0;
    for (const m of messages) {
      if (!m) continue;
      chars += 24;
      if (typeof m.content === "string") {
        chars += m.content.length;
        continue;
      }
      if (!Array.isArray(m.content)) continue;
      for (const b of m.content) {
        chars += PER_BLOCK_OVERHEAD;
        if (b.type === "text" && typeof b.text === "string") chars += b.text.length;
        else if (b.type === "tool_use") {
          chars += (b.name?.length || 0) + (b.id?.length || 0);
          try { chars += JSON.stringify(b.input || {}).length; } catch {}
        } else if (b.type === "tool_result") {
          chars += (b.tool_use_id?.length || 0);
          if (typeof b.content === "string") chars += b.content.length;
          else if (Array.isArray(b.content)) {
            for (const c of b.content) {
              if (typeof c?.text === "string") chars += c.text.length;
            }
          }
        }
      }
    }
    return Math.ceil(chars / CHARS_PER_TOKEN);
  }

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
        if (b.type === "text" && typeof b.text === "string" && b.text.length > TOOL_RESULT_MAX_CHARS) {
          mutated = true;
          return { ...b, text: truncOne(b.text) };
        }
        if (b.type === "tool_result" && typeof b.content === "string" && b.content.length > TOOL_RESULT_MAX_CHARS) {
          mutated = true;
          return { ...b, content: truncOne(b.content) };
        }
        if (b.type === "tool_result" && Array.isArray(b.content)) {
          let blockMutated = false;
          const newBlocks = b.content.map((c) => {
            if (typeof c?.text !== "string" || c.text.length <= TOOL_RESULT_MAX_CHARS) return c;
            blockMutated = true;
            return { ...c, text: truncOne(c.text) };
          });
          if (blockMutated) {
            mutated = true;
            return { ...b, content: newBlocks };
          }
        }
        return b;
      });
      return mutated ? { ...m, content: newContent } : m;
    });
  }

  compress(messages, _opts = {}) {
    return this.hardTruncate(messages);
  }

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
