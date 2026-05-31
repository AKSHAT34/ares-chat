// ContextEngine — abstract base class for prompt-window compression strategies.
//
// Phase U03 split the compression logic out of lib/agent.js so the agent loop
// stops owning a specific strategy. Two concrete engines ship today:
//
//   - AnchorContextEngine   (lib/context/anchor.js)  — current production
//                                                       behaviour. Keeps user
//                                                       turns + durable
//                                                       artefacts verbatim,
//                                                       collapses filler runs
//                                                       into <context_summary>
//                                                       turns. Pressure-aware.
//   - HeadTruncateContextEngine (lib/context/head-truncate.js) — simpler
//                                                       baseline. Keeps first
//                                                       user turn + last K
//                                                       messages, drops the
//                                                       middle.
//
// Pick via `ARES_CONTEXT_ENGINE=anchor|head-truncate` (default `anchor`).
// The agent does NOT special-case engine names — it only calls the methods
// declared here.
//
// Engines are stateless. `Agent` instantiates one at construction time and
// hands the same instance to every turn.

/**
 * @typedef {Object} CompressionOpts
 * @property {0|1|2} [pressure] — 0=lightest, 2=most aggressive
 * @property {number} [toolResultThreshold]      — anchor cut-off in chars
 * @property {number} [assistantTextThreshold]   — anchor cut-off in chars
 * @property {Set<number>} [recentUserAnchorIdxs] — which user turn idxs to anchor
 */

export class ContextEngine {
  /** Identifier exposed via /api/health and audit gates. */
  get name() { return "base"; }

  /**
   * @param {Array} messages
   * @param {{tokens?: number}} ctx — caller-provided prompt-token estimate
   * @returns {boolean}
   */
  shouldCompress(_messages, _ctx = {}) { return false; }

  /**
   * Return a NEW messages array (callers may mutate). Must NEVER break the
   * Bedrock invariant `tool_use[i] ↔ tool_result[i+1]` — caller will run
   * sanitize after compress, but the engine should not introduce orphans.
   *
   * @param {Array} messages
   * @param {CompressionOpts} [opts]
   * @returns {Array}
   */
  compress(messages, _opts = {}) { return messages; }

  /**
   * Estimate the prompt-token cost of the transcript. Block overhead is
   * 40 chars per content block + ~24 chars per message wrapper. Bedrock
   * Claude treats ~2.6 chars/token on mixed text+JSON.
   * @param {Array} _messages
   * @returns {number}
   */
  estimateTokens(_messages) { return 0; }

  /**
   * Cap any single tool_result or text block at TOOL_RESULT_MAX_CHARS.
   * Returns a new array; only mutated messages are cloned.
   */
  truncateLargeToolResults(messages) { return messages; }

  /**
   * Last-resort: keep the first user turn + the last K, drop everything
   * else with a single summary marker. Caller will sanitize.
   */
  hardTruncate(messages) { return messages; }

  /**
   * Token thresholds the engine wants the caller to surface. The agent
   * publishes these on every `token_budget` SSE event so the UI meter
   * can render headroom.
   */
  get limits() {
    return {
      bedrockMax: 200000,
      bedrockSafeMax: 195000,
      soft: 65000,
      hard: 80000,
      maxMessages: 60,
      keepRecent: 8,
    };
  }
}
