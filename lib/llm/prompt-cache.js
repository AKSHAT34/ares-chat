// Phase U04 — Bedrock prompt-cache stamping.
//
// Bedrock's Anthropic 2023-05-31 schema honours `cache_control: {type:
// "ephemeral"}` on system-prompt blocks and on tool definitions. With ~103K
// tokens of static overhead per turn (system prompt + tool schemas + steering
// catalog) caching is a huge cost/latency win — the first send creates the
// cache (`cache_creation_input_tokens`), subsequent sends hit it
// (`cache_read_input_tokens`) for ~5 minutes.
//
// We stamp two breakpoints per request:
//   1. End of the system prompt (Ares' identity + steering + MCP catalog —
//      ~32K tokens, churn rate ~0 within a session).
//   2. The LAST tool in the tool array (covers every tool above it via a
//      single breakpoint — Anthropic allows max 4 breakpoints; we use 2).
//
// Mode is controlled by ARES_PROMPT_CACHE:
//   on   — always stamp. Failures bubble up.
//   off  — never stamp. Falls back to plain payloads.
//   auto — start in 'on' mode. If a single request fails with a
//          cache-control rejection, the module flips to disabled for the
//          life of the process and logs a one-line warning.
//
// The driver reads usage tokens off every Bedrock response and feeds the
// hit/miss counters here so /api/metrics can surface cache effectiveness.

import { incCounter } from "../observability.js";

const VALID_MODES = new Set(["on", "off", "auto"]);

let _modeAtBoot = readModeFromEnv();
let _runtimeEnabled = _modeAtBoot !== "off";
let _autoDisabledReason = null;

function readModeFromEnv() {
  const raw = (process.env.ARES_PROMPT_CACHE || "auto").toLowerCase().trim();
  if (!VALID_MODES.has(raw)) {
    console.warn(`[prompt-cache] unknown ARES_PROMPT_CACHE="${raw}"; falling back to "auto"`);
    return "auto";
  }
  return raw;
}

/**
 * Is cache stamping currently active? Driver consults this on every
 * payload build. Cheap enough (just a boolean) to call hot-path.
 */
export function isCacheEnabled() {
  return _runtimeEnabled;
}

/**
 * One-line probe-style status block for boot logging and the doctor probe
 * (Phase U18). Stable enough for tests to grep.
 */
export function cacheStatus() {
  return {
    mode: _modeAtBoot,
    enabled: _runtimeEnabled,
    autoDisabledReason: _autoDisabledReason,
  };
}

/**
 * Force the cache into a specific state. Used by:
 *   - the Bedrock-error classifier when a cache_control rejection is
 *     observed in `auto` mode (flips to disabled);
 *   - the audit gate, which exercises both stamped and unstamped paths.
 *
 * NEVER call this from production code outside the auto-disable path.
 */
export function setEnabled(value, reason = null) {
  _runtimeEnabled = !!value;
  _autoDisabledReason = reason;
  if (!value && reason) {
    console.warn(`[prompt-cache] auto-disabled: ${reason}`);
  }
}

/**
 * Reset internal state. Test hook. Not used in production.
 */
export function _resetForTests() {
  _modeAtBoot = readModeFromEnv();
  _runtimeEnabled = _modeAtBoot !== "off";
  _autoDisabledReason = null;
}

/**
 * Convert a string system prompt into the cache-stamped array form.
 * Returns the original input if the cache is disabled or the system value
 * is already an array (caller's responsibility — we don't try to merge).
 */
export function stampSystem(system) {
  if (!_runtimeEnabled) return system;
  if (typeof system !== "string" || !system.length) return system;
  return [{
    type: "text",
    text: system,
    cache_control: { type: "ephemeral" },
  }];
}

/**
 * Stamp the LAST tool in a tools array with cache_control. One breakpoint
 * implicitly covers every tool above it. Returns the original array if
 * caching is off or the array is empty / already stamped.
 *
 * Defensive: never mutates the input. The driver passes the same `tools`
 * array on every call; mutating would silently leak cache_control onto
 * the caller's reference.
 */
export function stampTools(tools) {
  if (!_runtimeEnabled) return tools;
  if (!Array.isArray(tools) || tools.length === 0) return tools;
  if (tools[tools.length - 1]?.cache_control) return tools;
  const last = tools[tools.length - 1];
  return [
    ...tools.slice(0, -1),
    { ...last, cache_control: { type: "ephemeral" } },
  ];
}

/**
 * Read the `usage` block off a Bedrock Anthropic response and bump the
 * cache counters. Both `invoke()` results and stream `message_start`
 * events carry the same shape.
 *
 *   usage = {
 *     input_tokens,
 *     output_tokens,
 *     cache_creation_input_tokens,  // first send that primed the cache
 *     cache_read_input_tokens,      // subsequent sends that hit the cache
 *   }
 *
 * "Hit" semantics: any positive cache_read_input_tokens. "Miss": any
 * positive cache_creation OR a request with cache enabled that returned
 * neither field (model didn't honour cache_control).
 */
export function recordUsage(usage) {
  if (!usage || typeof usage !== "object") return;
  const created = Number(usage.cache_creation_input_tokens || 0);
  const read = Number(usage.cache_read_input_tokens || 0);

  if (read > 0) {
    incCounter("ares_prompt_cache_hits_total");
    incCounter("ares_prompt_cache_read_tokens_total", read);
  }
  if (created > 0) {
    incCounter("ares_prompt_cache_creation_tokens_total", created);
  }
  // A request emitted with caching on that returned ZERO read AND zero
  // creation either bypassed the cache or the inference profile silently
  // dropped the cache_control headers. Count it as a miss so dashboards
  // show why the hit rate is low.
  if (_runtimeEnabled && read === 0 && created === 0 && Number(usage.input_tokens || 0) > 0) {
    incCounter("ares_prompt_cache_misses_total");
  }
}

/**
 * Inspect a Bedrock error and decide whether it's a cache_control rejection.
 * Some inference profiles silently strip cache_control; some return a
 * ValidationException citing it. In `auto` mode we self-disable on the first
 * such observation and never look back.
 */
export function isCacheControlRejection(err) {
  if (!err) return false;
  const msg = ((err.message || "") + " " + (err.name || "")).toLowerCase();
  return /cache_control|cache control|prompt cache/.test(msg);
}

/**
 * Bridge for the driver's catch block. If the active mode is `auto` and
 * the error looks like a cache rejection, flip the runtime off and return
 * true so the driver can retry the same request without stamping. Returns
 * false otherwise (caller rethrows).
 */
export function maybeAutoDisable(err) {
  if (_modeAtBoot !== "auto") return false;
  if (!_runtimeEnabled) return false;
  if (!isCacheControlRejection(err)) return false;
  setEnabled(false, `Bedrock rejected cache_control: ${err.message}`);
  return true;
}
