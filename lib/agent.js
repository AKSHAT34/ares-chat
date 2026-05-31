// ReAct-style agent loop for Bedrock Claude + MCP tools.
// Streams events to the caller via an async generator so the HTTP
// layer can forward them to the browser over SSE.
//
// Compression is delegated to a ContextEngine (Phase U03). Default engine
// is anchor-aware (lib/context/anchor.js); swap via ARES_CONTEXT_ENGINE.
// Limits live on engine.limits so a swap doesn't require touching this file.

import { peekCredentials, refreshCredentials } from "./bedrock.js";
import { makeContextEngine } from "./context/index.js";
import { getPluginRegistry } from "./plugins/loader.js";
import { shapeHash } from "./util/shape-hash.js";
import { detectChartBlock } from "./chart-detect.js";
import { suggestNextActions } from "./next-action-suggestions.js";

const MAX_ITERATIONS = 500; // Raised from 200 for true long-run survival. Progress detector catches stalls earlier.

// Q-pass-4 / work-stream A — Tier-1 MCPs whose tools we MUST keep when
// capping the tool list to fit under the schema budget. Mirrors the
// first 5 entries of `ALWAYS_ACTIVE_DEFAULTS` in lib/mcp-client.js.
// Anything from any other MCP is a candidate for dropping when the
// JSON-encoded tool list exceeds the budget.
export const TIER1_MCPS = [
  "kiro-memory",       // alias accepted in case a future rename lands
  "memory",
  "kiro-skills",       // alias accepted
  "skills",
  "shell-agent",
  "filesystem-agent",
  "ares-actions",
];
const TIER1_PREFIXES = TIER1_MCPS.map((s) => `${s}__`);
// Meta-tools that must always survive (ares_activate_mcp, ares_delegate_subagent, etc.).
const META_TOOL_PREFIX = "ares_";

// Default tool-schema budget in tokens. Tunable via env so operators can
// dial it up if they want richer tool coverage on a beefier model. ~80K
// fits comfortably under the 195K Bedrock safe-max with room for the
// system prompt + transcript.
const DEFAULT_TOOL_SCHEMA_BUDGET_TOKENS = 80000;
function getToolSchemaBudgetTokens() {
  const v = Number(process.env.ARES_TOOL_SCHEMA_BUDGET);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TOOL_SCHEMA_BUDGET_TOKENS;
}

// How close to expiry we force a pre-stream credential refresh. 2 min
// gives the SDK some headroom before the request fires.
const PRESTREAM_CREDENTIAL_MIN_MINUTES = 2;
// Throttle pre-stream liveness checks so we don't hit the provider every
// single iteration — the SDK already refreshes at 5 min skew.
const PRESTREAM_CHECK_THROTTLE_MS = 60 * 1000;

// Progress detector tunables (Item 4 — stall detection).
const STALL_ITERATION_WINDOW = 30;   // consider last N iterations
const STALL_MIN_TEXT_DELTA = 50;     // chars of new text counts as progress
const STALL_NUDGE_AFTER = 30;        // iterations with no progress before nudge
const STALL_BAIL_AFTER_NUDGE = 5;    // extra iterations to bail if no progress post-nudge

// Heartbeat cadence (Item 6 — progress UI). Lowered 60s→5s (2026-05-30):
// a 60s gap between liveness pings made long Opus thinking phases look
// frozen ("the process stream stops in between"). A 5s pulse keeps the
// activity row + elapsed timer visibly alive without meaningful cost
// (one tiny JSON event every 5s).
const HEARTBEAT_INTERVAL_MS = 5 * 1000;

// Premature-stop recovery: if Claude stops without calling a tool but the
// last turn in the transcript was a tool_result (meaning it was
// mid-workflow), nudge it and retry before declaring done. Phase RP1-B1
// raised the limit from 1 to 3 with escalating prompts + backoff so a
// single max_tokens punt doesn't mark a multi-step workflow as complete.
const PREMATURE_STOP_NUDGE_LIMIT = 3;

// Backoff per attempt (ms). Index = attempt-1 (0 → first nudge, etc.).
// 0/2s/5s = ~7s of total delay if all three fire — small price for
// avoiding a falsely-cheerful `done`.
const PREMATURE_STOP_BACKOFF_MS = [0, 2000, 5000];

// Three escalating nudges. attempt 1 = gentle continue; attempt 2 adds
// a status-summary fallback; attempt 3 forces an explicit choice. The
// audit gate verifies all three strings are present and distinct.
const PREMATURE_STOP_NUDGES = [
  "[system recovery nudge: you stopped mid-workflow without calling a tool or emitting a substantive reply. This usually means you ran out of output-token budget while planning a large action. Please continue with the very next concrete step — if you need to emit a long script, break it into multiple smaller tool calls instead of one giant one. Do not re-state the plan; just execute the next step now.",
  "[system recovery nudge #2: you still haven't continued. If you cannot proceed with the next concrete step, emit a one-paragraph status summary describing what you've done so far, what's blocking you, and what remains. Do not silently end the turn — the user is waiting on either progress or a clear status.",
  "[system recovery nudge #3 — final attempt: this is your last chance to make a choice. Either complete the next concrete step now, OR explicitly state 'I am stopping because <reason>' so the user knows the run is incomplete. A silent end here will be reported to the user as a premature stop.",
];

export class Agent {
  constructor({ bedrock, hub, systemPrompt, log = console.log, contextEngine = null, approvalGate = null, platform = null, haikuFactory = null }) {
    this.bedrock = bedrock;
    this.hub = hub;
    this.systemPrompt = systemPrompt;
    this.log = log;
    // Phase U06 — optional async (toolUse) → { event?, deny?, reason?, resolved? }
    // hook. Server.js binds it to the current sessionId so the gate can
    // emit `approval_required`/`approval_resolved` events on the SSE stream
    // and block until the HTTP approve/deny endpoint responds.
    this.approvalGate = approvalGate;
    // Phase U16 — when set, hub.getClaudeTools() filters via the platform's
    // allow/deny rules in ares-config.json. Server passes the value of
    // ?platform=… on the /api/chat request.
    this.platform = platform || null;
    // Q-pass-2: haikuFactory feeds the knowledge-graph per-turn
    // extractor. Optional; agent works fine without it (graph just
    // doesn't auto-map per-turn — only the 6h refresh + cold build).
    this.haikuFactory = haikuFactory;
    // Phase U03 — pluggable context engine. Default is the anchor strategy;
    // override via constructor or ARES_CONTEXT_ENGINE env var. The engine
    // owns compression, classification, large-block truncation, and the
    // hard-truncate fallback. Limits are mirrored onto `this.*` so the
    // existing call sites that referenced module-level TOKEN_* / KEEP_*
    // constants keep working without churn.
    this.contextEngine = contextEngine || makeContextEngine();
    const L = this.contextEngine.limits;
    this.MAX_MESSAGES_BEFORE_COMPRESS = L.maxMessages;
    this.KEEP_RECENT_MESSAGES = L.keepRecent;
    this.TOKEN_BEDROCK_MAX = L.bedrockMax;
    this.TOKEN_BEDROCK_SAFE_MAX = L.bedrockSafeMax;
    this.TOKEN_SOFT_LIMIT = L.soft;
    this.TOKEN_HARD_LIMIT = L.hard;
    this.TOOL_RESULT_MAX_CHARS = L.toolResultMaxChars;
  }

  /**
   * Pull the most recent plain-text user query from the working transcript.
   * Skips tool_result-only user messages (those have content blocks but
   * no text the user typed). Returns "" if no real user message is found.
   */
  _extractLastUserQuery(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role !== "user") continue;
      if (typeof m.content === "string") return m.content.slice(0, 2000);
      if (!Array.isArray(m.content)) continue;
      const texts = m.content
        .filter((b) => b?.type === "text" && typeof b.text === "string")
        .map((b) => b.text);
      if (texts.length === 0) continue; // tool_result-only — skip
      // Strip <file>/<attachment> wrappers the same way server.js does
      let t = texts.join("\n");
      t = t.replace(/<(file|attachment)[^>]*>[\s\S]*?<\/\1>/gi, "");
      t = t.replace(/<(file|attachment)[^>]*>[\s\S]*$/gi, "");
      t = t.trim();
      if (t) return t.slice(0, 2000);
    }
    return "";
  }

  /**
   * Render retrieved past turns into a compact system-prompt suffix.
   * The model sees this as authoritative recall context, NOT as live
   * transcript — it should treat it like a citation.
   */
  _formatRelevantHistory(hits) {
    // Per-snippet cap ≈ 100 tokens. With up to 6 hits, the whole block stays
    // under ~700 tokens — small enough to be free even at high token budgets.
    const SNIPPET_CHARS = 320;
    const lines = ["<relevant_history>",
      "Earlier in this conversation, the following turns may be relevant. Recall hints from the session index — not part of the live transcript.",
      ""];
    for (const h of hits) {
      const snippet = (h.text || "").slice(0, SNIPPET_CHARS).replace(/\s+/g, " ");
      const when = h.ts ? new Date(h.ts).toISOString().slice(0, 10) : "?";
      lines.push(`[#${h.seq} ${h.role} ${when}] ${snippet}`);
    }
    lines.push("</relevant_history>");
    return lines.join("\n");
  }

  /**
   * Render the last N USER messages verbatim. Cheap, deterministic recall
   * for meta-questions like "what did I just say?" / "in my last message
   * I told you X — repeat it back". Vector-RAG fails these because the
   * query embeds the meta-phrasing, not the substance, so we bypass the
   * index entirely and just dump the actual recent user text.
   *
   * Skips synthetic user messages (tool_result wrappers, <context_summary>
   * carriers) so the model sees only what the human actually typed.
   *
   * Returns null when there is nothing useful to inject (e.g. the very
   * first turn of a fresh session).
   */
  _formatRecentUserTurns(messages, n = 4) {
    if (!Array.isArray(messages) || !messages.length) return null;
    const PER_TURN_CHARS = 1500;
    const collected = [];
    // Walk newest -> oldest, skip the CURRENT user turn (last one), pick the
    // previous N genuine user turns.
    let seenCurrent = false;
    for (let i = messages.length - 1; i >= 0 && collected.length < n; i--) {
      const m = messages[i];
      if (!m || m.role !== "user") continue;

      // Skip the most recent user message — that is the live query the
      // model is already responding to; including it again is noise.
      if (!seenCurrent) { seenCurrent = true; continue; }

      // Extract plain text. Skip tool_result-only carriers.
      let text = "";
      if (typeof m.content === "string") {
        text = m.content;
      } else if (Array.isArray(m.content)) {
        if (m.content.every((b) => b && b.type === "tool_result")) continue;
        text = m.content
          .filter((b) => b && b.type === "text" && typeof b.text === "string")
          .map((b) => b.text)
          .join("\n");
      }
      text = (text || "").trim();
      if (!text) continue;

      // Strip server-side wrapper tags so the model sees only authored text.
      const stripped = text
        .replace(/<context_summary\b[^>]*>[\s\S]*?<\/context_summary>/gi, "")
        .replace(/<(file|attachment)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .trim();
      if (!stripped) continue;

      collected.push(stripped.slice(0, PER_TURN_CHARS));
    }

    if (!collected.length) return null;
    // Reverse so oldest → newest reads naturally.
    collected.reverse();
    const lines = [
      "<recent_user_turns>",
      "Verbatim text of the user's previous messages in this session (oldest first, most recent last). Use this directly for any meta-question about what the user said earlier (e.g. 'what did I just tell you?', 'repeat my last message', 'in my previous message I…'). Excludes the current message you are responding to.",
      "",
    ];
    collected.forEach((t, idx) => {
      const offset = collected.length - idx; // 1 = previous turn, 2 = the one before, …
      lines.push(`[turn -${offset}]`);
      lines.push(t);
      lines.push("");
    });
    lines.push("</recent_user_turns>");
    return lines.join("\n");
  }

  /**
   * Token estimate for the message transcript only. We use 2.6 chars/tok
   * (down from 3.2) — the prior value undercounted by ~25% in practice on
   * mixed text + JSON-heavy tool results, causing real Bedrock prompts to
   * land at 200K+ when our budget said we were at 145K. Block-wrapper
   * overhead (role+type+id boilerplate JSON the API serialises around each
   * block) is also added in: ~40 chars per content block.
   *
   * NOTE: this counts the TRANSCRIPT only. The system prompt (~25K tokens)
   * and tool schemas (~1K per active MCP) are added on by Bedrock and are
   * accounted for separately via the engine's overhead reservation.
   */
  _estimateTokens(messages) {
    return this.contextEngine.estimateTokens(messages);
  }

  /**
   * Truncate any large block — tool_result OR text — that exceeds the
   * engine's per-block cap. Delegates to the active ContextEngine.
   * Phase U03: extracted to lib/context/<engine>.js for swappability.
   */
  _truncateLargeToolResults(messages) {
    return this.contextEngine.truncateLargeToolResults(messages);
  }

  /**
   * Compress older messages into a summary while preserving anchors.
   * Delegates to the active ContextEngine. Pressure 0/1/2 controls
   * aggressiveness (anchor engine's contract; head-truncate ignores it).
   */
  _compressMessages(messages, options = {}) {
    return this.contextEngine.compress(messages, options);
  }

  /**
   * Hard-truncate fallback — used only when iterative compression at max
   * pressure still leaves us above TOKEN_HARD_LIMIT. Engine-specific.
   */
  _hardTruncate(messages) {
    return this.contextEngine.hardTruncate(messages);
  }

  /**
   * Remove orphaned tool_result blocks AND synthesise missing tool_result
   * blocks for any assistant tool_use that didn't get a response before the
   * next user turn. Claude's API rejects the transcript if either side is
   * missing, so we normalise both directions.
   *
   * Typical cause: the server crashed mid-turn (credentials expired, process
   * killed) right after emitting `tool_call` events but before appending the
   * `tool_result` blocks to session.json. On the next send we reload that
   * partial transcript and Bedrock returns messages.N: tool_use ids were
   * found without tool_result blocks.
   *
   * Post-compression cause: the compressor inserts synthetic summary
   * assistant messages between an anchor assistant tool_use and its
   * original tool_result user message. Bedrock then sees a tool_result
   * that references a tool_use in messages[N-2], not [N-1], and rejects.
   * We fix this by either healing the pair (if the tool_use is still
   * present anywhere above) or stripping the orphan.
   */
  _sanitizeMessages(messages) {
    // --- Pass 0: merge consecutive same-role messages. Bedrock requires
    //     strict user/assistant alternation. Consecutive user messages
    //     (e.g. from interrupted saves or multi-part user input) get
    //     their content blocks merged into a single message.
    const merged = [];
    for (const m of messages) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === m.role && Array.isArray(prev.content) && Array.isArray(m.content)) {
        prev.content = [...prev.content, ...m.content];
      } else {
        merged.push({ ...m, content: Array.isArray(m.content) ? [...m.content] : m.content });
      }
    }

    // Build a global set of valid tool_use_ids that appear anywhere in
    // the transcript. A tool_result is only orphaned if its id exists
    // NOWHERE above it — that's a clean Claude API violation we can't
    // heal by re-ordering.
    const validToolUseIds = new Set();
    for (const m of merged) {
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
      for (const b of m.content) {
        if (b.type === "tool_use" && b.id) validToolUseIds.add(b.id);
      }
    }

    // --- Pass 1: drop tool_result blocks whose tool_use_id isn't in the
    //     full transcript. These are unrecoverable orphans (the tool_use
    //     side was lost in a crash or compression). Also drop tool_results
    //     whose immediately-preceding message isn't an assistant with the
    //     matching tool_use — because Bedrock enforces adjacency even if
    //     the id appears earlier in the transcript.
    const pass1 = [];
    for (let i = 0; i < merged.length; i++) {
      const m = merged[i];
      if (m.role === "user" && Array.isArray(m.content)) {
        const hasToolResults = m.content.some((b) => b.type === "tool_result");
        if (hasToolResults) {
          // The immediately-previous message in our OUTPUT array is what
          // matters for Bedrock adjacency. pass1[pass1.length-1] is the
          // last message we pushed (could be an assistant or a user).
          const prev = pass1[pass1.length - 1];
          const adjacentIds = new Set();
          if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
            for (const b of prev.content) {
              if (b.type === "tool_use" && b.id) adjacentIds.add(b.id);
            }
          }
          const filtered = m.content.filter((b) => {
            if (b.type !== "tool_result") return true;
            return adjacentIds.has(b.tool_use_id) && validToolUseIds.has(b.tool_use_id);
          });
          const prevHasToolUse = pass1.length > 0 &&
            pass1[pass1.length - 1].role === "assistant" &&
            Array.isArray(pass1[pass1.length - 1].content) &&
            pass1[pass1.length - 1].content.some((b) => b.type === "tool_use");
          if (filtered.length === 0 && !prevHasToolUse) continue;
          pass1.push({ ...m, content: filtered.length > 0 ? filtered : [] });
        } else {
          pass1.push(m);
        }
      } else {
        pass1.push(m);
      }
    }

    // --- Pass 2: make sure every assistant tool_use has a matching
    //     tool_result in the *immediately following* user message. If the
    //     transcript was truncated mid-turn, we synthesise stub results so
    //     Bedrock accepts the transcript.
    const pass2 = [];
    for (let i = 0; i < pass1.length; i++) {
      const m = pass1[i];
      pass2.push(m);
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue;

      const toolUseIds = m.content
        .filter((b) => b.type === "tool_use" && b.id)
        .map((b) => b.id);
      if (toolUseIds.length === 0) continue;

      const next = pass1[i + 1];
      const isNextUserWithBlocks = next && next.role === "user" && Array.isArray(next.content);
      const existingResultIds = new Set(
        isNextUserWithBlocks
          ? next.content
              .filter((b) => b.type === "tool_result" && b.tool_use_id)
              .map((b) => b.tool_use_id)
          : []
      );
      const missing = toolUseIds.filter((id) => !existingResultIds.has(id));
      if (missing.length === 0) continue;

      const stubs = missing.map((id) => ({
        type: "tool_result",
        tool_use_id: id,
        content: [{
          type: "text",
          text: "(result missing — previous run was interrupted before the tool response was recorded)",
        }],
        is_error: true,
      }));

      if (isNextUserWithBlocks) {
        const replaced = { ...next, content: [...stubs, ...next.content] };
        pass2.push(replaced);
        i += 1;
      } else {
        pass2.push({ role: "user", content: stubs });
      }
    }

    const pass3 = [];
    for (let i = 0; i < pass2.length; i++) {
      const m = pass2[i];
      if (m.role !== "assistant" || !Array.isArray(m.content)) { pass3.push(m); continue; }
      const tuIds = m.content.filter((b) => b.type === "tool_use" && b.id).map((b) => b.id);
      if (tuIds.length === 0) { pass3.push(m); continue; }
      const nxt = pass2[i + 1];
      const nxtRIds = new Set(nxt && nxt.role === "user" && Array.isArray(nxt.content)
        ? nxt.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id) : []);
      if (tuIds.every((id) => nxtRIds.has(id))) { pass3.push(m); continue; }
      const matched = new Set(tuIds.filter((id) => nxtRIds.has(id)));
      const healed = m.content.filter((b) => b.type !== "tool_use" || matched.has(b.id));
      if (healed.length === 0) {
        if (nxt && nxt.role === "user" && Array.isArray(nxt.content) &&
            nxt.content.every((b) => b.type === "tool_result")) i++;
        continue;
      }
      pass3.push({ ...m, content: healed });
    }
    return pass3;
  }

  /**
   * Q-pass-4 work-stream A — drop the lowest-priority tools until the
   * JSON-encoded tool list fits under `budgetTokens`. Tier-1 tools
   * (memory/skills/shell-agent/filesystem-agent/ares-actions + meta
   * tools) are NEVER dropped. Returns a result object so the caller can
   * yield a `tools_capped` event with the diff.
   *
   * @param {Array} tools — full tool list from hub.getClaudeTools()
   * @param {number} budgetTokens — char budget = budgetTokens * 2.6
   * @param {{tier1Only?: boolean}} [opts] — when true, drop EVERYTHING
   *        except Tier-1 + meta tools regardless of fit. Used by the
   *        per-session `_tier1Only` recovery flag.
   * @returns {{kept: Array, dropped: string[], originalCount: number,
   *           keptCount: number, jsonChars: number, fittedUnderBudget: boolean}}
   */
  _capTools(tools, budgetTokens, opts = {}) {
    if (!Array.isArray(tools) || tools.length === 0) {
      return { kept: [], dropped: [], originalCount: 0, keptCount: 0, jsonChars: 0, fittedUnderBudget: true };
    }
    const budgetChars = Math.max(0, Math.floor(budgetTokens * 2.6));
    const isTier1 = (name) => {
      if (!name) return false;
      if (name.startsWith(META_TOOL_PREFIX)) return true;
      return TIER1_PREFIXES.some((p) => name.startsWith(p));
    };

    // Tier-1-only mode: a session-scoped recovery flag may force-drop
    // every non-tier-1 tool regardless of budget. Used by
    // POST /api/sessions/:id/trim-mcps.
    if (opts.tier1Only) {
      const kept = tools.filter((t) => isTier1(t.name));
      const dropped = tools.filter((t) => !isTier1(t.name)).map((t) => t.name);
      const json = JSON.stringify(kept);
      return {
        kept,
        dropped,
        originalCount: tools.length,
        keptCount: kept.length,
        jsonChars: json.length,
        fittedUnderBudget: json.length <= budgetChars,
      };
    }

    // Greedy: start with everything, then drop non-Tier-1 tools (largest
    // schema first — they cost the most) until we fit or run out.
    const work = [...tools];
    const droppedNames = [];
    const measure = () => {
      try { return JSON.stringify(work).length; } catch { return Number.POSITIVE_INFINITY; }
    };
    let chars = measure();
    if (chars <= budgetChars) {
      return { kept: work, dropped: [], originalCount: tools.length, keptCount: work.length, jsonChars: chars, fittedUnderBudget: true };
    }

    // Build a max-heap-ish sorted view of dropping candidates. We
    // recompute only when needed (each iteration removes at most one).
    const candidateIdxs = work
      .map((t, i) => ({ i, name: t.name, tier1: isTier1(t.name) }))
      .filter((x) => !x.tier1)
      .map((x) => {
        let size = 0;
        try { size = JSON.stringify(work[x.i]).length; } catch {}
        return { ...x, size };
      })
      .sort((a, b) => b.size - a.size);

    // Track which work-array indices we've already nulled out.
    const dropped = new Set();
    for (const cand of candidateIdxs) {
      if (chars <= budgetChars) break;
      // Recompute the tool's contribution against the *current* compact
      // representation — JSON.stringify's per-element overhead is small
      // and constant, so the precomputed size is good enough as a
      // priority signal.
      dropped.add(cand.i);
      droppedNames.push(cand.name);
      // Build the compact view by skipping dropped indices.
      const compact = work.filter((_, i) => !dropped.has(i));
      try { chars = JSON.stringify(compact).length; } catch { chars = Number.POSITIVE_INFINITY; }
    }
    const kept = work.filter((_, i) => !dropped.has(i));
    return {
      kept,
      dropped: droppedNames,
      originalCount: tools.length,
      keptCount: kept.length,
      jsonChars: chars,
      fittedUnderBudget: chars <= budgetChars,
    };
  }

  /**
   * Run one user turn. `messages` is the full conversation history
   * in Anthropic Messages API format (user/assistant content blocks).
   * The new user message should already be appended.
   *
   * Yields events:
   *   { type: 'text_delta', text }
   *   { type: 'tool_call', name, input, id }
   *   { type: 'tool_result', id, output, isError }
   *   { type: 'iteration', n }
   *   { type: 'context_compressed', originalCount, compressedCount }
   *   { type: 'heartbeat', iteration, elapsedSec, activeToolName, mcpsActive }
   *   { type: 'credentials_refreshing', minutesLeft }
   *   { type: 'stalled', iterations }
   *   { type: 'done', finalMessages }
   *   { type: 'error', error }
   */
  async *run(messages, { abortSignal, retrieveContext, retrieveMemoryBrief } = {}) {
    // Phase U03 — pull engine-controlled limits into local consts so the
    // existing call sites (which referenced module-level TOKEN_* / KEEP_*
    // constants) keep working unchanged. The values come from the active
    // ContextEngine's `limits` block via the constructor.
    const {
      MAX_MESSAGES_BEFORE_COMPRESS,
      KEEP_RECENT_MESSAGES,
      TOKEN_BEDROCK_MAX,
      TOKEN_BEDROCK_SAFE_MAX,
      TOKEN_SOFT_LIMIT,
      TOKEN_HARD_LIMIT,
      TOOL_RESULT_MAX_CHARS,
    } = this;

    const fullTools = this.hub.getClaudeTools(this.platform || undefined);

    // Q-pass-4 work-stream A — cap the tool-schema list under the
    // configured budget so a 49-MCP catalog (≈530 tools) doesn't blow
    // past Bedrock's 195K-token safe-max before any user message lands.
    // The session-scoped `_tier1Only` flag (set by POST
    // /api/sessions/:id/trim-mcps) forces dropping every non-Tier-1 tool
    // even if the budget would otherwise fit.
    const toolBudgetTokens = getToolSchemaBudgetTokens();
    const tier1Only = !!this._tier1Only;
    // Q-pass-5 P0-4 — Direct mode: skip MCPs entirely, single Bedrock
    // turn. Persona (SOUL/USER/MEMORY) stays in the system prompt.
    const directMode = this._aresRouting === "direct";
    const capRes = directMode
      ? { kept: [], dropped: [], originalCount: fullTools.length, keptCount: 0, jsonChars: 0, fittedUnderBudget: true }
      : this._capTools(fullTools, toolBudgetTokens, { tier1Only });
    const tools = capRes.kept;
    // Always announce which model is performing this turn so the UI can
    // surface "Opus 4.7 is thinking…" / "Sonnet 4.6 is thinking…" instead
    // of a bare spinner. Pre-fix this only fired in directMode, so smart
    // mode runs left the user guessing.
    yield {
      type: "model_info",
      model: this.bedrock.modelId,
      mode: directMode ? "direct" : "smart",
      routing: this._aresRouting || "smart",
      toolCount: tools.length,
      note: directMode ? "MCPs disabled — single-turn Bedrock answer" : null,
    };
    if (!directMode && capRes.dropped.length > 0) {
      yield {
        type: "tools_capped",
        originalCount: capRes.originalCount,
        keptCount: capRes.keptCount,
        droppedTools: capRes.dropped,
        budgetTokens: toolBudgetTokens,
        jsonChars: capRes.jsonChars,
        fittedUnderBudget: capRes.fittedUnderBudget,
        reason: tier1Only ? "tier1-only-session-flag" : "tool-schema-budget",
      };
    }

    // Phase U14 — fire preTurn hook. Plugins are observers here; failures
    // are swallowed inside the registry so the agent loop never blocks
    // on a misbehaving plugin.
    try {
      await getPluginRegistry().fire("preTurn", { messages, sessionId: this._sessionId || null });
    } catch {}

    // Helper: throw an AbortError the moment the client disconnects.
    // Wrapped so every check site stays a single line.
    const checkAbort = () => {
      if (abortSignal?.aborted) {
        const e = new Error("Aborted by client");
        e.name = "AbortError";
        throw e;
      }
    };

    // Sanitize first, then truncate large tool results, then sanitize again
    // (truncation never invalidates pairs but the order is cheap and clear).
    const sanitized0 = this._sanitizeMessages(messages);
    const truncated = this._truncateLargeToolResults(sanitized0);
    const sanitized = this._sanitizeMessages(truncated);

    // Iterative compression by token + message budget.
    //
    // Triggers (any of):
    //   - message count > MAX_MESSAGES_BEFORE_COMPRESS, OR
    //   - estimated tokens > TOKEN_SOFT_LIMIT (150K)
    //
    // Each pressure level (0/1/2) discards more anchors. If pressure 2
    // still doesn't fit under TOKEN_HARD_LIMIT (180K), we hard-truncate
    // to first-user + last-N as a final safety net.
    let working = [...sanitized];
    const initialTokens = this._estimateTokens(working);
    const initialCount = working.length;
    const needsCompression =
      working.length > MAX_MESSAGES_BEFORE_COMPRESS ||
      initialTokens > TOKEN_SOFT_LIMIT;

    if (needsCompression) {
      let bestTokens = initialTokens;
      let bestCount = initialCount;
      for (const pressure of [0, 1, 2]) {
        const compressed = this._compressMessages(working, { pressure });
        // Compression can break the tool_use ↔ tool_result invariant when
        // a filler run is summarised between an anchor assistant-with-
        // tool_use and its matching result user message. Re-sanitize.
        working = this._sanitizeMessages(compressed);
        bestTokens = this._estimateTokens(working);
        bestCount = working.length;
        if (bestTokens <= TOKEN_SOFT_LIMIT) break;
      }
      // Final safety: hard-truncate if still too big.
      if (bestTokens > TOKEN_HARD_LIMIT) {
        working = this._sanitizeMessages(this._hardTruncate(working));
        bestTokens = this._estimateTokens(working);
        bestCount = working.length;
      }
      yield {
        type: "context_compressed",
        originalCount: initialCount,
        compressedCount: bestCount,
        originalTokens: initialTokens,
        compressedTokens: bestTokens,
        bedrockMax: TOKEN_BEDROCK_MAX,
      };
    }

    // Loop detection. Two tiers (RP1-B5 layered on top of v1):
    //   Tier 1 (v1, kept): three IDENTICAL (name + exact input) calls in a
    //     row → hard fail. Stays on `recentCalls` so behaviour is
    //     unchanged from the prior shape.
    //   Tier 2 (v2, new): sliding-window count keyed on (toolName,
    //     shape-hash). 5 hits in the last 12 iterations with <2 useful
    //     outputs fires `tool_loop_warning` (soft); 3 more matching
    //     iterations after the warning hard-fails.
    const recentCalls = []; // last 3 tool calls as signatures (tier 1)
    const recentToolHistory = []; // [{name, shapeHash, success, iter}] (tier 2)
    let toolLoopWarningAtIter = -1; // -1 = not yet warned

    // Premature-stop recovery state (see PREMATURE_STOP_NUDGE_LIMIT docblock).
    let prematureStopNudgesUsed = 0;
    // Per-attempt history captured for the post-exhaustion premature_stop event:
    // [{attempt, nudgeText, stopReason, totalChars, ts}]. Lets the UI/recorder
    // explain to the user *why* the run is being marked incomplete.
    const prematureStopHistory = [];
    // B-3: max_tokens escalation. Bedrock Claude 4.x typically caps at
    // 32k; we step up only when we observed a max_tokens stop reason on
    // the previous iteration. This is per-loop state, not global, so
    // each new run starts fresh at 16k.
    const MAX_TOKENS_LADDER = [16384, 24576, 32000];
    let maxTokensIdx = 0;
    let lastStopReasonWasMaxTokens = false;

    // Progress detector state (Item 4).
    // Each iteration records {textBytes, newToolNames[]} so we can tell a
    // productive loop from a stall. "Progress" = >= STALL_MIN_TEXT_DELTA
    // new chars OR at least one tool call whose name we haven't seen
    // in the last STALL_ITERATION_WINDOW iterations.
    const progressLog = []; // [{iter, textBytes, toolNames}]
    const seenToolNamesInWindow = () => {
      const out = new Set();
      for (const e of progressLog.slice(-STALL_ITERATION_WINDOW)) {
        for (const t of e.toolNames) out.add(t);
      }
      return out;
    };
    let nudgeSentAtIter = -1;  // -1 = not yet nudged
    let stalledBailAtIter = -1;

    // Heartbeat state (Item 6).
    const runStartedAt = Date.now();
    let lastHeartbeatAt = runStartedAt;
    let currentToolName = null; // updated when a tool is being executed
    const heartbeatNow = () => ({
      type: "heartbeat",
      iteration: progressLog.length,
      elapsedSec: Math.round((Date.now() - runStartedAt) / 1000),
      activeToolName: currentToolName,
      mcpsActive: this.hub.getActiveServers?.() || [],
      model: this.bedrock.modelId,
    });

    // Pre-stream credential liveness throttle state (Item 2).
    let lastCredentialCheckAt = 0;

    // Phase C (P1-3) — the transient context suffix (recent-turns +
    // session-RAG + memory_brief + knowledge-graph) is keyed entirely off
    // the user's query for THIS turn, which does not change between ReAct
    // iterations. We compute it ONCE (iteration 0) and reuse it for the
    // rest of the turn. Caching here (not inside the loop) is what stops
    // the per-iteration re-fetch + re-inject that made context appear to
    // "grow and get fed back" on every tool round-trip.
    let turnContextSuffix = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      checkAbort();
      yield { type: "iteration", n: i + 1 };

      // Per-iteration token guard. Tool results can balloon the working
      // transcript mid-run (a single DataQuery query can return 50K+ tokens of
      // rows). If we drift back over the soft limit, re-run the iterative
      // compressor before the next bedrock call so we never hit the 200K
      // ceiling. Cheap: estimateTokens is O(N) char counting.
      const liveTokens = this._estimateTokens(working);
      // Emit a budget event so the UI can render a context-window meter
      // and the user can see headroom in real time.
      yield {
        type: "token_budget",
        tokens: liveTokens,
        bedrockMax: TOKEN_BEDROCK_MAX,
        soft: TOKEN_SOFT_LIMIT,
        hard: TOKEN_HARD_LIMIT,
      };
      if (liveTokens > TOKEN_SOFT_LIMIT) {
        const beforeCount = working.length;
        // Always re-truncate large results first — a single new response
        // can be the entire reason we're over budget.
        let next = this._truncateLargeToolResults(working);
        next = this._sanitizeMessages(next);
        let nextTokens = this._estimateTokens(next);
        // Then escalate compression pressure until we fit (or run out of
        // pressure levels and have to hard-truncate).
        if (nextTokens > TOKEN_SOFT_LIMIT) {
          for (const pressure of [0, 1, 2]) {
            next = this._sanitizeMessages(this._compressMessages(next, { pressure }));
            nextTokens = this._estimateTokens(next);
            if (nextTokens <= TOKEN_SOFT_LIMIT) break;
          }
        }
        if (nextTokens > TOKEN_HARD_LIMIT) {
          next = this._sanitizeMessages(this._hardTruncate(next));
          nextTokens = this._estimateTokens(next);
        }
        working = next;
        yield {
          type: "context_compressed",
          originalCount: beforeCount,
          compressedCount: working.length,
          originalTokens: liveTokens,
          compressedTokens: nextTokens,
          bedrockMax: TOKEN_BEDROCK_MAX,
          midRun: true,
        };
      }

      // Heartbeat if overdue (Item 6). Cheap — just a JSON event.
      if (Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        yield heartbeatNow();
        lastHeartbeatAt = Date.now();
      }

      // Yield progress every 5 iterations so the server can save incrementally
      if (i > 0 && i % 5 === 0) {
        yield { type: "progress", messages: working };
      }

      // Checkpoint after every iteration so a crash mid-long-run can
      // resume from the most recent stable state. Cheap — writes a few
      // hundred KB at most to disk.
      yield { type: "checkpoint", iteration: i, messages: working };

      // --- Item 2: Pre-stream credential liveness check. If STS is
      // close to expiry, force a refresh BEFORE the long-lived stream
      // starts, so we don't get an ExpiredTokenException 40 minutes
      // into a single turn. Throttled to once per 60 s max.
      if (Date.now() - lastCredentialCheckAt >= PRESTREAM_CHECK_THROTTLE_MS) {
        lastCredentialCheckAt = Date.now();
        const peek = peekCredentials(this.bedrock.profile);
        if (peek.valid && peek.minutesLeft < PRESTREAM_CREDENTIAL_MIN_MINUTES) {
          yield { type: "credentials_refreshing", minutesLeft: peek.minutesLeft };
          try {
            await refreshCredentials(this.bedrock.profile);
          } catch (err) {
            // If refresh fails here, the subsequent stream() will throw a
            // credential error which the existing handler catches. Don't
            // short-circuit — let the normal error path produce the UI
            // banner with the auth-init CTA.
            this.log(`[creds] pre-stream refresh failed: ${err.message}`);
          }
        }
      }

      let assistantContent = [];
      let stopReason = null;
      let currentBlock = null;
      let currentToolInputJson = "";
      let textDeltaBytesThisIter = 0;   // for stall detection
      const toolNamesThisIter = [];     // for stall detection
      // Phase 11.2 — synthetic system messages (stall nudge / loop
      // warning) MUST NOT be pushed as standalone user messages between
      // an assistant tool_use and its tool_results — Bedrock requires
      // strict adjacency. Buffer them here and splice into the
      // tool_results user message at the bottom of the iteration.
      let pendingNudgeText = null;
      let pendingLoopWarningText = null;

      // Session-RAG retrieval. Pull up to K relevant past turns from the
      // session-scoped index based on the most recent user query, then
      // inject them as a transient system-prompt suffix. They never enter
      // the persisted transcript — they're recall hints for THIS turn only.
      //
      // Skip RAG retrieval entirely when the transcript is already close to
      // the soft limit. Adding ~5K tokens of <relevant_history> on top of a
      // near-full transcript is what pushed actual Bedrock prompts past 200K
      // when our budget said we were at 145K. The transcript itself already
      // contains the recent context the model needs; RAG is a luxury we can
      // skip when budget-constrained.
      const RAG_SAFETY_HEADROOM = 10000;
      let systemForCall = this.systemPrompt;
      const tokensForRagDecision = this._estimateTokens(working);

      // Phase C (P1-3) — compute the transient context suffix ONCE per turn
      // (first iteration) and cache it. Re-fetching memory_brief / KG /
      // session-RAG on every ReAct iteration re-injected the same context
      // repeatedly (the "expanding & fed back" symptom) and burned latency.
      // The suffix is keyed off the user query, which is stable across the
      // turn, so caching is safe. Parts are appended (not overwritten) so
      // recent-turns + RAG + brief + KG all survive — fixing a latent
      // clobber where session-RAG reset systemForCall to this.systemPrompt.
      if (turnContextSuffix === null) {
        const parts = [];

        // Always-on verbatim recent-turns window. Independent of RAG (no
        // 30-turn threshold, no vector-similarity gating). This is what
        // makes "what did I just say?" reliable. Tiny budget impact.
        try {
          const recentBlock = this._formatRecentUserTurns(working, 4);
          if (recentBlock && tokensForRagDecision + 2000 < TOKEN_HARD_LIMIT) {
            parts.push(recentBlock);
            yield { type: "recent_turns_injected", chars: recentBlock.length };
          }
        } catch (err) {
          this.log(`[recent-turns] inject skipped: ${err.message}`);
        }

        if (
          typeof retrieveContext === "function" &&
          tokensForRagDecision + RAG_SAFETY_HEADROOM < TOKEN_SOFT_LIMIT
        ) {
          try {
            const lastUserText = this._extractLastUserQuery(working);
            if (lastUserText) {
              const hits = await retrieveContext({
                query: lastUserText,
                excludeFromSeq: working.length, // don't retrieve current working msgs
              });
              if (Array.isArray(hits) && hits.length) {
                const block = this._formatRelevantHistory(hits);
                parts.push(block);
                yield {
                  type: "session_rag_hit",
                  count: hits.length,
                  seqs: hits.map((h) => h.seq),
                };
              }
            }
          } catch (err) {
            this.log(`[session-rag] retrieve skipped: ${err.message}`);
          }
        } else if (typeof retrieveContext === "function") {
          // Tell the UI we deliberately skipped RAG to protect the budget.
          yield {
            type: "session_rag_skipped",
            reason: "budget",
            tokens: tokensForRagDecision,
            headroom: RAG_SAFETY_HEADROOM,
          };
        }

        // Layer-2 memory brief — preferences + recent journal hits.
        // Auto-injected once per turn so the model never has to remember
        // to call memory_context_brief itself. Capped at ~800 tokens.
        if (typeof retrieveMemoryBrief === "function" && tokensForRagDecision + RAG_SAFETY_HEADROOM < TOKEN_SOFT_LIMIT) {
          try {
            const lastUserText = this._extractLastUserQuery(working);
            const brief = await retrieveMemoryBrief({ query: lastUserText, turnIndex: working.length });
            if (brief && typeof brief === "string" && brief.trim()) {
              const block = `<memory_brief>\n${brief.trim().slice(0, 3200)}\n</memory_brief>`;
              parts.push(block);
              yield { type: "memory_used", layer: 2, chars: block.length };
            }
          } catch (err) {
            this.log(`[memory-brief] retrieve skipped: ${err.message}`);
          }
        }

        // Q-pass-2: Layer-3 — KNOWLEDGE GRAPH retrieval.
        // Pull entities mentioned in the user prompt and inject their
        // first-degree neighbours so the agent gets graph-aware context
        // without an explicit lookup tool call. Cheap (in-process file
        // read) and bounded.
        try {
          const lastUserText = this._extractLastUserQuery(working);
          if (lastUserText && tokensForRagDecision + RAG_SAFETY_HEADROOM < TOKEN_SOFT_LIMIT) {
            const kg = await import("./knowledge-graph-builder.js");
            const entities = kg.entitiesInText(lastUserText);
            if (entities.length > 0) {
              const lines = [];
              lines.push("<knowledge_graph_context>");
              lines.push("# Entities recognised in this prompt + their connections");
              for (const ent of entities.slice(0, 6)) {
                const nbrs = kg.neighboursOf(ent.id, { limit: 6 });
                lines.push(`## ${ent.label} (${ent.type})`);
                if (nbrs.length === 0) {
                  lines.push("  - no recorded connections yet");
                } else {
                  for (const n of nbrs) {
                    if (n.direction === "out") lines.push(`  - ${n.label} → ${n.to}`);
                    else lines.push(`  - ${n.from} → ${n.label} → ${ent.id}`);
                  }
                }
              }
              lines.push("</knowledge_graph_context>");
              const block = lines.join("\n");
              parts.push(block);
              yield { type: "memory_used", layer: 3, chars: block.length, source: "knowledge-graph", entities: entities.length };
            }
          }
        } catch (err) {
          // Graph retrieval is best-effort — never block the turn.
          this.log(`[kg] retrieve skipped: ${err.message}`);
        }

        turnContextSuffix = parts.length ? `\n\n${parts.join("\n\n")}` : "";
      }

      // Append the cached per-turn context suffix to the system prompt.
      if (turnContextSuffix) systemForCall = `${systemForCall}${turnContextSuffix}`;

      // ===== PRE-FLIGHT TOTAL-PROMPT CHECK =====
      // Estimate the FULL prompt size (system + tools + transcript) and
      // refuse-then-compress before we even open the stream. Far cheaper
      // than discovering the rejection mid-stream and recovering. Tool
      // schemas dominate at ~70K with several MCPs active; this is what
      // we were missing before.
      let totalPromptTokens = (() => {
        const sysChars = systemForCall?.length || 0;
        let toolsChars = 0;
        try { toolsChars = JSON.stringify(tools || []).length; } catch {}
        const transcript = this._estimateTokens(working);
        return Math.ceil((sysChars + toolsChars) / 2.6) + transcript;
      })();
      let preflightAttempt = 0;
      while (totalPromptTokens > TOKEN_BEDROCK_SAFE_MAX && preflightAttempt < 4) {
        preflightAttempt += 1;
        const beforeCount = working.length;
        const beforeTotal = totalPromptTokens;
        // Strategy by attempt:
        //   1: drop RAG suffix (saves ~3K), recompute
        //   2: pressure-2 compress
        //   3: hard truncate
        //   4: emergency floor (first user + last 2)
        if (preflightAttempt === 1) {
          systemForCall = this.systemPrompt;
        } else if (preflightAttempt === 2) {
          working = this._sanitizeMessages(this._compressMessages(working, { pressure: 2 }));
        } else if (preflightAttempt === 3) {
          working = this._sanitizeMessages(this._hardTruncate(working));
        } else {
          const head = working.slice(0, 1);
          const tail = working.slice(-2);
          working = this._sanitizeMessages([...head, {
            role: "assistant",
            content: [{ type: "text", text: "<context_summary truncated=\"emergency\">Pre-flight check: transcript trimmed to fit Bedrock window.</context_summary>" }],
          }, ...tail]);
        }
        totalPromptTokens = (() => {
          const sysChars = systemForCall?.length || 0;
          let toolsChars = 0;
          try { toolsChars = JSON.stringify(tools || []).length; } catch {}
          const transcript = this._estimateTokens(working);
          return Math.ceil((sysChars + toolsChars) / 2.6) + transcript;
        })();
        yield {
          type: "context_compressed",
          originalCount: beforeCount,
          compressedCount: working.length,
          originalTokens: beforeTotal,
          compressedTokens: totalPromptTokens,
          bedrockMax: TOKEN_BEDROCK_MAX,
          preflight: true,
          preflightAttempt,
        };
      }
      if (totalPromptTokens > TOKEN_BEDROCK_SAFE_MAX) {
        // We tried everything and still can't fit. Fail fast with a clear
        // error rather than letting Bedrock reject — that wastes a round-trip
        // and confuses the UI.
        //
        // Q-pass-4 work-stream A — augment the event with a structured
        // `recovery` array so the chat-surface error renderer can show
        // user-actionable buttons. Work-stream B wires the UI; we just
        // emit the data here.
        yield {
          type: "error",
          error: `Cannot fit prompt under ${TOKEN_BEDROCK_SAFE_MAX.toLocaleString()} tokens after preflight (estimated ${totalPromptTokens.toLocaleString()}). Start a new chat to recover.`,
          kind: "preflight_too_large",
          observedTokens: totalPromptTokens,
          recovery: [
            { id: "compress",       label: "Compress now",      endpoint: "/api/sessions/:id/compress?pressure=3", method: "POST" },
            { id: "strip-steering", label: "Drop steering",     endpoint: "/api/sessions/:id/strip-steering",      method: "POST" },
            { id: "trim-mcps",      label: "Trim active MCPs",  endpoint: "/api/sessions/:id/trim-mcps",           method: "POST" },
            { id: "show-breakdown", label: "Show breakdown",    endpoint: "/api/dev/prompt-debug?sessionId=:id",   method: "GET"  },
            { id: "new-session",    label: "Start fresh chat",  endpoint: "/api/sessions",                         method: "POST" },
          ],
        };
        return;
      }

      // Auto-recover from "prompt is too long" — Bedrock tells us the exact
      // token count it saw, so we treat that as ground truth, recompress
      // hard, and retry the same iteration. We try up to 3 times before
      // giving up. Each attempt drops more aggressively than the last:
      //   attempt 1: hard-truncate to fit observed_tokens - safety
      //   attempt 2: hard-truncate to fit + drop ALL non-tier1 RAG hints
      //   attempt 3: drop everything except first user + last 4 messages
      const MAX_OVERFLOW_RETRIES = 3;
      let overflowAttempt = 0;
      // Re-enter the stream block on overflow. Goto-style with a labelled
      // outer loop avoids deeply nested try/catch.
      streamLoop: while (true) {
        try {
          // B-3: bump max_tokens if the prior iteration ran out. Cap at
          // the top of the ladder; Bedrock rejects above the model max.
          if (lastStopReasonWasMaxTokens && maxTokensIdx < MAX_TOKENS_LADDER.length - 1) {
            maxTokensIdx++;
          }
          const currentMaxTokens = MAX_TOKENS_LADDER[maxTokensIdx];
          lastStopReasonWasMaxTokens = false;
          // Phase 11.2 — defensive re-sanitize just before each Bedrock
          // call. The post-iteration push paths can produce subtly
          // out-of-order pairs (e.g. when retroactive nudges are
          // injected); pre-fix we relied on entry-time sanitize which
          // doesn't re-run between iterations under the SOFT_LIMIT.
          // O(N) on the working transcript — cheap relative to the
          // network round-trip we're about to make.
          working = this._sanitizeMessages(working);
          const stream = this.bedrock.stream({
            system: systemForCall,
            messages: working,
            tools,
            max_tokens: currentMaxTokens,
            temperature: 0.5,
          }, { abortSignal });

          for await (const ev of stream) {
            // In-stream liveness — emit a heartbeat every HEARTBEAT_INTERVAL_MS
            // even while a single bedrock stream is mid-flight (a long
            // thinking phase emits no text for many seconds). Without this,
            // the only heartbeat was at the TOP of each iteration, so a slow
            // turn looked frozen. Cheap: just a timer check per chunk.
            if (Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
              yield heartbeatNow();
              lastHeartbeatAt = Date.now();
            }
            switch (ev.type) {
              case "_resume_reset": {
                // B-1: bedrock-driver injects this sentinel just before
                // the resumed stream replays message_start. The new
                // stream starts the message from scratch, so any text
                // deltas / content blocks accumulated pre-refresh must
                // be discarded — otherwise the user sees duplicated
                // text and tool_use blocks dispatch twice.
                assistantContent = [];
                currentBlock = null;
                currentToolInputJson = "";
                textDeltaBytesThisIter = 0;
                toolNamesThisIter.length = 0;
                stopReason = null;
                // Pass through to the SSE consumer so a downstream
                // recorder / debug overlay can see the reset.
                yield { type: "credentials_resumed", attempt: ev.attempt };
                break;
              }

              case "credentials_refreshing": {
                // Pass-through observability event — the driver yielded
                // this just before re-opening the stream. UI shows a
                // small "refreshing credentials" chip.
                yield ev;
                break;
              }

              case "message_start":
                break;

              case "content_block_start": {
                currentBlock = { ...ev.content_block };
                if (currentBlock.type === "tool_use") {
                  currentBlock.input = {};
                  currentToolInputJson = "";
                  // Surface that the model has started composing a tool
                  // call so the UI can show "preparing <tool>…" before the
                  // args finish streaming ("what the model is doing").
                  yield { type: "tool_call_started", name: currentBlock.name, id: currentBlock.id };
                } else if (currentBlock.type === "text") {
                  currentBlock.text = "";
                } else if (currentBlock.type === "thinking") {
                  currentBlock.thinking = "";
                  yield { type: "thinking_start" };
                }
                break;
              }

              case "content_block_delta": {
                if (!currentBlock) break;
                const d = ev.delta;
                if (d.type === "text_delta") {
                  currentBlock.text += d.text;
                  textDeltaBytesThisIter += (d.text || "").length;
                  yield { type: "text_delta", text: d.text };
                } else if (d.type === "thinking_delta") {
                  // Extended-thinking stream — surface the model's live
                  // reasoning so the UI can render it in the thinking block
                  // ("what the model is thinking"). Counts as progress so
                  // the stall detector doesn't fire during a long think.
                  currentBlock.thinking = (currentBlock.thinking || "") + (d.thinking || "");
                  textDeltaBytesThisIter += (d.thinking || "").length;
                  yield { type: "thinking_delta", text: d.thinking || "" };
                } else if (d.type === "signature_delta") {
                  // Thinking-block signature — opaque; no UI surface needed.
                } else if (d.type === "input_json_delta") {
                  currentToolInputJson += d.partial_json;
                  // Stream the tool-args as they build so the UI shows the
                  // call forming live instead of popping in fully-formed.
                  yield { type: "tool_args_delta", partial: d.partial_json || "" };
                }
                break;
              }

              case "content_block_stop": {
                if (!currentBlock) break;
                if (currentBlock.type === "tool_use") {
                  try {
                    currentBlock.input = currentToolInputJson
                      ? JSON.parse(currentToolInputJson)
                      : {};
                  } catch (e) {
                    // B-4: pre-fix this was a silent fallback to {}.
                    // Now: log + emit a structured event so the UI / SSE
                    // / auto-recorder can see WHY the model is about to
                    // dispatch a tool with an empty arg map.
                    currentBlock.input = {};
                    const preview = currentToolInputJson.length > 240
                      ? currentToolInputJson.slice(0, 240) + "…"
                      : currentToolInputJson;
                    this.log(`[agent] tool_use input parse failed for ${currentBlock.name}: ${e.message}; partial_json=${JSON.stringify(preview)}`);
                    yield {
                      type: "agent_warning",
                      kind: "tool_input_parse_failed",
                      toolName: currentBlock.name,
                      toolUseId: currentBlock.id,
                      error: e.message,
                      partialJsonLength: currentToolInputJson.length,
                    };
                  }
                  toolNamesThisIter.push(currentBlock.name);
                }
                assistantContent.push(currentBlock);
                currentBlock = null;
                currentToolInputJson = "";
                break;
              }

              case "message_delta": {
                if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
                break;
              }

              case "message_stop":
                break;
            }
          }
          // Stream completed normally — break out of the retry loop.
          break streamLoop;
        } catch (err) {
          // Client aborted — surface a distinct event and end cleanly.
          if (err?.name === "AbortError" || abortSignal?.aborted) {
            yield { type: "aborted", reason: "client-stop" };
            return;
          }

          // Detect "prompt is too long: N tokens > M maximum" and auto-fix.
          // Bedrock's message format is exactly:
          //   "prompt is too long: 214484 tokens > 200000 maximum"
          // We parse N (the actual size it saw) so we can target a budget
          // that genuinely fits, even if our local estimator was off.
          const promptTooLong = /prompt is too long:\s*(\d+)\s*tokens?\s*>\s*(\d+)/i.exec(err?.message || "");
          if (promptTooLong && overflowAttempt < MAX_OVERFLOW_RETRIES) {
            overflowAttempt += 1;
            const observedTokens = parseInt(promptTooLong[1], 10);
            const observedMax = parseInt(promptTooLong[2], 10);
            // Reset the partial assistant message we'd accumulated — none
            // of those deltas reached the model since the request was
            // rejected upfront. Same for the per-iter signal counters.
            assistantContent = [];
            currentBlock = null;
            currentToolInputJson = "";
            textDeltaBytesThisIter = 0;
            toolNamesThisIter.length = 0;

            // Recalibrate. The transcript we sent was estimated at X tokens
            // locally but Bedrock saw observedTokens overall. The delta
            // (observed − local) is the system+tools+RAG overhead we
            // weren't accounting for. Use that to pick a safe transcript
            // budget for the retry.
            const localTranscriptTokens = this._estimateTokens(working);
            const overheadTokens = Math.max(0, observedTokens - localTranscriptTokens);
            // Target: leave at least 8K headroom under Bedrock's max so a
            // few-thousand-token assistant reply still fits without spilling.
            const targetTranscript = observedMax - overheadTokens - 8000;

            yield {
              type: "context_compressed",
              originalCount: working.length,
              compressedCount: working.length, // updated below after compression
              originalTokens: localTranscriptTokens,
              compressedTokens: localTranscriptTokens,
              bedrockMax: observedMax,
              autoRecover: true,
              attempt: overflowAttempt,
              observed: observedTokens,
              targetTranscript,
            };

            // Run the compression ladder against the OBSERVED budget, not
            // our local estimate.
            let next = this._truncateLargeToolResults(working);
            next = this._sanitizeMessages(next);
            for (const pressure of [0, 1, 2]) {
              if (this._estimateTokens(next) <= targetTranscript) break;
              next = this._sanitizeMessages(this._compressMessages(next, { pressure }));
            }
            // If still too big OR this is the second-or-later attempt, hard-truncate.
            if (this._estimateTokens(next) > targetTranscript || overflowAttempt >= 2) {
              next = this._sanitizeMessages(this._hardTruncate(next));
            }
            // Last-resort: keep just the first user turn and the very last
            // turn so the model has SOMETHING to respond to. This is the
            // attempt-3 floor.
            if (this._estimateTokens(next) > targetTranscript && overflowAttempt >= 3) {
              const head = next.slice(0, 1);
              const tail = next.slice(-2);
              const marker = {
                role: "assistant",
                content: [{
                  type: "text",
                  text: `<context_summary truncated="emergency">Most of the transcript was dropped to fit Bedrock's ${observedMax.toLocaleString()}-token window after ${overflowAttempt} retries. Continuing from the last user turn only.</context_summary>`,
                }],
              };
              next = this._sanitizeMessages([...head, marker, ...tail]);
            }
            working = next;
            // Also drop the RAG suffix from the system prompt for this
            // retry — it can be 5K extra tokens we don't have room for.
            systemForCall = this.systemPrompt;

            // Yield a follow-up event reflecting the actual reduction
            // (the first one above was emitted before compression).
            yield {
              type: "context_compressed",
              originalCount: working.length,
              compressedCount: working.length,
              originalTokens: localTranscriptTokens,
              compressedTokens: this._estimateTokens(working),
              bedrockMax: observedMax,
              autoRecover: true,
              attempt: overflowAttempt,
              observed: observedTokens,
            };
            // Retry the bedrock call.
            continue streamLoop;
          }

          // Credential problems are friendlier as a structured event so the
          // UI can show an actionable CTA ("run auth-init") instead of a raw
          // Bedrock traceback.
          if (err?.isCredentialError) {
            yield {
              type: "error",
              error: err.message,
              kind: "credentials",
              reason: err.reason || "unknown",
              needsAuth: true,
            };
          } else if (promptTooLong) {
            // Exhausted overflow retries — give up gracefully.
            yield {
              type: "error",
              error: `bedrock prompt-too-long after ${overflowAttempt} retries: ${err.message}`,
              kind: "context_overflow",
              attempts: overflowAttempt,
            };
          } else {
            yield { type: "error", error: `bedrock error: ${err.message}` };
          }
          return;
        }
      }

      // Push the assistant turn onto the working transcript
      working.push({ role: "assistant", content: assistantContent });

      // --- Item 4: progress detector — append this iteration's signal,
      // then decide whether we're stalled. ---
      progressLog.push({
        iter: i,
        textBytes: textDeltaBytesThisIter,
        toolNames: toolNamesThisIter,
      });
      {
        // Find the last iteration (in the window) that showed progress.
        const window = progressLog.slice(-STALL_ITERATION_WINDOW);
        let lastProgressIter = -1;
        // Consider a iteration "productive" if it yielded enough text OR at
        // least one tool call whose NAME first appeared in the last
        // STALL_ITERATION_WINDOW iterations (i.e. not just repeating the
        // same tool over and over).
        for (let k = 0; k < window.length; k++) {
          const e = window[k];
          if (e.textBytes >= STALL_MIN_TEXT_DELTA) {
            lastProgressIter = e.iter;
            continue;
          }
          // Set of tool names seen BEFORE this iteration within the window.
          const earlier = new Set();
          for (const prior of window.slice(0, k)) {
            for (const n of prior.toolNames) earlier.add(n);
          }
          const hasNewTool = e.toolNames.some((n) => !earlier.has(n));
          if (hasNewTool) lastProgressIter = e.iter;
        }
        const itersSinceProgress = lastProgressIter < 0
          ? progressLog.length
          : i - lastProgressIter;

        if (itersSinceProgress >= STALL_NUDGE_AFTER && nudgeSentAtIter < 0) {
          // First stall: inject a synthetic nudge and let the agent try
          // one more time. We DON'T yield 'error' yet — the user sees a
          // `stalled` event, then the agent gets one more turn with the
          // nudge in its transcript.
          //
          // Phase 11.2 — the previous assistant turn may have ended in
          // tool_use blocks. If so, splice the nudge text INTO the next
          // user message (the tool_results) instead of pushing a
          // standalone user [text] between them. Bedrock requires the
          // user-with-tool_results to be IMMEDIATELY after the
          // assistant-with-tool_use; an interloper user message breaks
          // adjacency and produces:
          //   "messages.N: tool_use ids were found without
          //    tool_result blocks immediately after"
          yield { type: "stalled", iterations: itersSinceProgress };
          const lastAssistant = working[working.length - 1];
          const lastEndsInToolUse =
            lastAssistant?.role === "assistant" &&
            Array.isArray(lastAssistant.content) &&
            lastAssistant.content.some((b) => b?.type === "tool_use");
          if (lastEndsInToolUse) {
            // Defer; will be merged into the tool_results user message.
            pendingNudgeText = "[system nudge: you have been looping without visible progress for 30+ iterations. Stop and: (a) state concretely what you have learned so far, (b) propose a different approach, or (c) ask the user a clarifying question. Do NOT call the same tool again without explaining why it will work this time.";
          } else {
            working.push({
              role: "user",
              content: [{ type: "text", text:
                "[system nudge: you have been looping without visible progress for 30+ iterations. Stop and: (a) state concretely what you have learned so far, (b) propose a different approach, or (c) ask the user a clarifying question. Do NOT call the same tool again without explaining why it will work this time." }],
            });
          }
          nudgeSentAtIter = i;
        } else if (nudgeSentAtIter >= 0 && i - nudgeSentAtIter >= STALL_BAIL_AFTER_NUDGE) {
          // Post-nudge, still stalled. Bail.
          yield { type: "error", error: `Stalled for ${itersSinceProgress} iterations after nudge. Stopping to avoid runaway.` };
          return;
        }
      }

      if (stopReason !== "tool_use") {
        // Premature-stop check: did Claude bail mid-workflow with no text
        // AND no tool_use? This happens when max_tokens runs out while
        // planning a big tool call. Symptoms:
        //   - content length 0 OR only a very short text block
        //   - previous user turn was a tool_result (so we were clearly
        //     in the middle of a plan)
        //   - stop_reason is end_turn or max_tokens (not stop_sequence)
        const totalChars = assistantContent
          .filter((b) => b.type === "text")
          .reduce((n, b) => n + (b.text?.length || 0), 0);
        const hasToolUse = assistantContent.some((b) => b.type === "tool_use");
        // RP1-B1 — `working` was just pushed with this iteration's empty
        // assistant turn at the top of the iteration. Skip past it to
        // find the prior user turn. Without this look-back-two, the
        // classifier always matched on the just-pushed assistant turn
        // and never fired.
        const prevMsg = working[working.length - 2];
        const prevWasToolResult = prevMsg?.role === "user" && Array.isArray(prevMsg.content) &&
          prevMsg.content.some((b) => b.type === "tool_result");
        // Once a recovery nudge has fired, subsequent empty turns count as
        // premature even though the prev message is now the nudge text
        // (not a tool_result). Otherwise the run silently completes after
        // the first nudge fails — exactly the bug RP1-B1 fixes.
        const inRecoveryWindow = prematureStopNudgesUsed > 0;
        // B-2: also recover from `stop_sequence`. The prompt-spec calls
        // this out — sequence-based stops in the middle of a workflow
        // (rare but real, e.g. when the model closes a fence the wrong
        // way) deserve the same nudge ladder as end_turn / max_tokens.
        const looksPremature = !hasToolUse && totalChars < 120 &&
          (prevWasToolResult || inRecoveryWindow) &&
          (stopReason === "end_turn" || stopReason === "max_tokens" || stopReason === "stop_sequence");
        // B-3: remember if max_tokens was hit so the next iteration can
        // escalate. Set regardless of looksPremature — even a productive
        // turn that bumped against the cap should bump the budget.
        if (stopReason === "max_tokens") lastStopReasonWasMaxTokens = true;

        if (looksPremature && prematureStopNudgesUsed < PREMATURE_STOP_NUDGE_LIMIT) {
          const attempt = prematureStopNudgesUsed + 1; // 1-indexed for humans
          const nudgeText = PREMATURE_STOP_NUDGES[prematureStopNudgesUsed];
          const backoffMs = PREMATURE_STOP_BACKOFF_MS[prematureStopNudgesUsed] || 0;
          prematureStopNudgesUsed++;
          prematureStopHistory.push({ attempt, nudgeText, stopReason, totalChars, ts: Date.now() });
          // The empty assistant turn was already pushed onto `working`
          // upstream at line ~953. Don't double-push.
          yield { type: "stalled", iterations: 0, reason: "premature-stop", attempt };
          if (backoffMs > 0) {
            await new Promise((r) => setTimeout(r, backoffMs));
          }
          working.push({
            role: "user",
            content: [{ type: "text", text: nudgeText }],
          });
          // Loop back — the outer `for` will do the next iteration.
          continue;
        }

        // RP1-B1: if we exhausted the nudge budget on a premature stop,
        // yield `premature_stop` instead of `done`. The auto-recorder /
        // UI use this to tag the memory entry as incomplete instead of
        // claiming the workflow finished cleanly.
        if (looksPremature && prematureStopNudgesUsed >= PREMATURE_STOP_NUDGE_LIMIT) {
          try {
            const lastAssistant = [...working].reverse().find((m) => m?.role === "assistant");
            const finalText = (Array.isArray(lastAssistant?.content)
              ? lastAssistant.content.filter((b) => b?.type === "text").map((b) => b.text).join("")
              : "");
            getPluginRegistry().fire("postTurn", { messages: working, finalText, sessionId: this._sessionId || null });
          } catch {}
          yield {
            type: "premature_stop",
            lastAttempt: prematureStopNudgesUsed,
            nudgeHistory: prematureStopHistory,
            finalMessages: working,
          };
          return;
        }

        // Phase U14 — fire postTurn before yielding done. Synthesise
        // the final assistant text so plugins can observe what was sent.
        try {
          const lastAssistant = [...working].reverse().find((m) => m?.role === "assistant");
          const finalText = (Array.isArray(lastAssistant?.content)
            ? lastAssistant.content.filter((b) => b?.type === "text").map((b) => b.text).join("")
            : "");
          const userText = this._extractLastUserQuery(working);
          getPluginRegistry().fire("postTurn", { messages: working, finalText, sessionId: this._sessionId || null });
          // Q-pass-2: knowledge-graph per-turn extraction. Fire-and-
          // forget so the agent never blocks on Haiku.
          if (this.haikuFactory) {
            const kg = await import("./knowledge-graph-builder.js");
            kg.runPerTurnExtract({
              haikuFactory: this.haikuFactory,
              userText, assistantText: finalText,
              sessionId: this._sessionId || null,
            });
          }
          // Q-pass-5 P0-1 — emit suggested next actions before `done`.
          // Heuristic generator (no Haiku call); fire-and-forget; never
          // blocks the run.
          try {
            const turnToolNames = [];
            for (const m of working) {
              if (m?.role !== "assistant" || !Array.isArray(m.content)) continue;
              for (const b of m.content) if (b?.type === "tool_use" && b.name) turnToolNames.push(b.name);
            }
            const chips = suggestNextActions({
              assistantText: finalText,
              userText,
              toolNames: turnToolNames,
              max: 4,
            });
            if (chips.length) yield { type: "suggested_actions", chips };
          } catch {}
        } catch {}
        yield { type: "done", finalMessages: working };
        return;
      }

      // Execute every tool_use block, build a single user message with results
      const toolUses = assistantContent.filter((b) => b.type === "tool_use");

      // Loop detection: if the same tool+input is being called 3 times in
      // a row, the agent is stuck. Bail with a clear error so the user
      // knows. The signature is recorded AFTER dispatch (below) so
      // RP1-B4-rejected oversized inputs don't falsely trip this counter
      // — the model is free to retry with smaller chunks.
      let iterationToolSig = null;
      if (toolUses.length > 0) {
        iterationToolSig = toolUses.map((tu) => `${tu.name}:${JSON.stringify(tu.input)}`).join("|");
      }

      const toolResults = [];
      // Tracks whether ANY tool call this iteration was rejected by
      // RP1-B4's oversize guard. When all calls were rejected we skip
      // the loop-detector signature push so the model can retry without
      // tripping the 3-strike abort.
      let allDispatchedCallsWereOversizeRejected = toolUses.length > 0;
      for (const tu of toolUses) {
        checkAbort();
        currentToolName = tu.name; // heartbeat marker

        // Phase U06 — pre-dispatch approval gate. If an approval gate was
        // wired via the Agent constructor (the server passes one bound to
        // the current sessionId), classify the call and pause for user
        // confirmation when the verdict requires it. Loop yields
        // approval_required → server proxies to SSE; resumes with
        // {decision: "approve"|"deny"} once the user responds.
        if (this.approvalGate) {
          const gate = await this.approvalGate(tu);
          if (gate?.event) yield gate.event;
          if (gate?.deny) {
            const denialMsg = gate.reason
              ? `Denied by user: ${gate.reason}`
              : "Denied by user.";
            yield { type: "tool_result", id: tu.id, name: tu.name, output: denialMsg, isError: true };
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: denialMsg,
              is_error: true,
            });
            continue;
          }
          if (gate?.resolved) yield gate.resolved;
        }

        yield { type: "tool_call", id: tu.id, name: tu.name, input: tu.input };
        let resultText = "";
        let isError = false;
        let oversizeRejected = false;
        try {
          // Phase 2: pass abortSignal so Stop button cancels in-flight tool calls.
          const res = await this.hub.callTool(tu.name, tu.input, { abortSignal });
          const parts = (res.content || []).map((c) => {
            if (c.type === "text") return c.text;
            if (c.type === "image") return "[image omitted]";
            return JSON.stringify(c);
          });
          resultText = parts.join("\n") || "(empty result)";
          if (res.isError) isError = true;
          // RP1-B4 — clear the all-rejected flag the first time a call
          // dispatches normally (or is rejected for any non-oversize
          // reason). Only when EVERY call this iteration was rejected
          // by the oversize guard do we skip the loop-detector push.
          if (res._aresOversizedToolInput) {
            oversizeRejected = true;
          } else {
            allDispatchedCallsWereOversizeRejected = false;
          }
        } catch (err) {
          resultText = `Error: ${err.message}`;
          isError = true;
          allDispatchedCallsWereOversizeRejected = false;
        }
        // Cap individual tool outputs to keep context tight
        if (resultText.length > 20000) {
          resultText = resultText.slice(0, 20000) + `\n\n[...truncated ${resultText.length - 20000} chars]`;
        }
        yield {
          type: "tool_result",
          id: tu.id,
          name: tu.name,
          output: resultText,
          isError,
        };
        // Q-pass-5 P0-3 — chart_block detection. If the tool emitted a
        // chart-shaped JSON, yield a parallel `chart_block` event so the
        // UI can render the infographic next to the raw tool_result.
        if (!isError) {
          try {
            const chart = detectChartBlock(resultText);
            if (chart) {
              yield {
                type: "chart_block",
                id: tu.id,
                name: tu.name,
                chart,
              };
            }
          } catch {}
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: resultText,
          is_error: isError,
        });
        // Q-pass-2: surface recoverable tool failures in the Activity
        // Feed so the user sees a "Retry" card without re-reading
        // the chat. Best-effort; the agent never blocks on this.
        if (isError) {
          try {
            const { recordToolError } = await import("./feed/index.js");
            recordToolError({
              tool: tu.name,
              error: resultText.slice(0, 280),
              sessionId: this._sessionId || null,
              retryHint: `Retry ${tu.name} with the same arguments`,
            });
          } catch {}
        }

        // RP1-B5 — tier-2 sliding-window record. Only count calls that
        // actually dispatched (skip oversize rejections so retries with
        // smaller chunks don't accumulate as "loop attempts"). Success
        // = !isError AND output >100 chars (filters out empty/error
        // results that don't meaningfully advance the workflow).
        if (!oversizeRejected) {
          const success = !isError && resultText.length > 100;
          recentToolHistory.push({
            name: tu.name,
            shapeHash: shapeHash(tu.input || {}),
            success,
            iter: i,
          });
          // Keep the window small so detection is O(window) per iter.
          while (recentToolHistory.length > 24) recentToolHistory.shift();
        }
      }
      currentToolName = null; // all tools finished this iteration

      // RP1-B4 — push the iteration's tool signature into the loop
      // detector ONLY if at least one dispatched call wasn't rejected
      // for oversize input. Otherwise the model is free to retry the
      // same conceptual call with smaller chunks without tripping the
      // 3-strike abort.
      if (iterationToolSig && !allDispatchedCallsWereOversizeRejected) {
        recentCalls.push(iterationToolSig);
        if (recentCalls.length > 3) recentCalls.shift();
        if (recentCalls.length === 3 && recentCalls.every((s) => s === iterationToolSig)) {
          yield { type: "error", error: `Loop detected: ${toolUses[0].name} called 3× with same input. Agent is stuck.` };
          return;
        }
      }

      // RP1-B5 tier-2 — sliding-window same-shape detection. Find the
      // most-frequent (name, shapeHash) in the last 12 iterations. If
      // it fires ≥5 times AND <2 produced useful output, soft-warn.
      // If the same pattern continues for 3 more iterations after the
      // warning, hard-fail.
      //
      // Phase 11.2 — set `pendingLoopWarningText` instead of pushing a
      // separate user message. Pre-fix we pushed a standalone `user`
      // message between the assistant's tool_use blocks and the
      // tool_results, which violated Bedrock's adjacency rule and
      // produced the "tool_use ids without tool_result blocks
      // immediately after" rejection.
      if (recentToolHistory.length >= 5) {
        const WINDOW_ITERS = 12;
        const WARN_THRESHOLD = 5;
        const SUCCESS_FLOOR = 2;
        const HARD_FAIL_AFTER_WARN_ITERS = 3;
        const oldestAllowedIter = i - WINDOW_ITERS + 1;
        const inWindow = recentToolHistory.filter((r) => r.iter >= oldestAllowedIter);
        // Group by (name, shapeHash) → counts.
        const groups = new Map();
        for (const r of inWindow) {
          const k = `${r.name}::${r.shapeHash}`;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(r);
        }
        // Walk groups; the one whose count crosses WARN_THRESHOLD is
        // the loop suspect. If multiple cross, take the largest.
        let suspect = null;
        for (const [k, list] of groups.entries()) {
          if (list.length >= WARN_THRESHOLD &&
              (!suspect || list.length > suspect.list.length)) {
            suspect = { key: k, list };
          }
        }
        if (suspect) {
          const successCount = suspect.list.filter((r) => r.success).length;
          if (successCount < SUCCESS_FLOOR) {
            if (toolLoopWarningAtIter < 0) {
              toolLoopWarningAtIter = i;
              const name = suspect.list[0].name;
              yield {
                type: "tool_loop_warning",
                tool: name,
                shapeHash: suspect.list[0].shapeHash,
                hits: suspect.list.length,
                successCount,
                windowIters: WINDOW_ITERS,
                message:
                  `You've called ${name} ${suspect.list.length} times with similar shapes ` +
                  `in the last ${WINDOW_ITERS} iterations and only ${successCount} produced useful output. ` +
                  `Consider a different tool or ask the user.`,
              };
              // Phase 11.2 — buffer the warning so we splice it INTO the
              // same user message as the tool_results below. Pushing it
              // as a standalone user message between the assistant
              // tool_use blocks and the tool_results breaks Bedrock's
              // adjacency rule and produces:
              //   "messages.N: tool_use ids were found without
              //    tool_result blocks immediately after"
              pendingLoopWarningText =
                `[system loop-warning: you have called ${name} ${suspect.list.length} times with the same input shape ` +
                `in the last ${WINDOW_ITERS} iterations and only ${successCount} produced useful output. ` +
                `Either change your approach (different tool, different shape, ask the user), or briefly explain ` +
                `why repeating this call is the right move. Continuing the same shape will hard-fail the run after ` +
                `${HARD_FAIL_AFTER_WARN_ITERS} more iterations.`;
            } else if (i - toolLoopWarningAtIter >= HARD_FAIL_AFTER_WARN_ITERS) {
              yield {
                type: "error",
                error:
                  `Loop detected (tier 2): ${suspect.list[0].name} kept the same input shape ${suspect.list.length}× ` +
                  `over ${WINDOW_ITERS} iterations after the warning. Agent is stuck.`,
              };
              return;
            }
          }
        }
      }

      // Phase 11.2 — splice any pending warning text INTO the
      // tool_results user message so the assistant tool_use is
      // immediately followed by a single user message containing both
      // the results AND the warning. Bedrock requires this adjacency.
      const prefixTexts = [];
      if (pendingNudgeText) prefixTexts.push({ type: "text", text: pendingNudgeText });
      if (pendingLoopWarningText) prefixTexts.push({ type: "text", text: pendingLoopWarningText });
      const userTurnContent = prefixTexts.length
        ? [...prefixTexts, ...toolResults]
        : toolResults;
      // Skip the push entirely if we have neither tool_results nor
      // prefix text — Bedrock rejects empty user content arrays.
      if (userTurnContent.length > 0) {
        working.push({ role: "user", content: userTurnContent });
      }
    }

    yield { type: "error", error: `hit max iterations (${MAX_ITERATIONS})` };
  }
}
