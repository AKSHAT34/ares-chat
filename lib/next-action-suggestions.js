// Phase Q-pass-5 P0-1 — "What would you like to focus on next?" chips.
//
// Heuristic-first generator (no Haiku call by default — keeps per-turn
// latency at zero). Reads the last assistant text + recent user message
// + recent tool calls and produces 3-4 actionable chip strings the user
// can click to fill the composer.
//
// Why heuristic and not Haiku? User specified Q3 = no Haiku cost. The
// heuristic produces lower-quality chips than a Haiku call would, but
// it's instant, deterministic, and free. If the heuristic produces zero
// chips we surface a generic fallback set rather than emitting nothing.
//
// Categories (one chip each, max 4):
//   1. PROBLEM — if the last text mentions red/below target/issue/error
//   2. NEXT-VENDOR — if a portfolio/comparison context mentions vendor codes
//   3. EMAIL — if the user asks about a vendor or recent issue
//   4. RECORD — generic "save as skill" chip when ≥3 tools fired
//   5. ELSE — fallback to "Something else" + 2-3 seeded prompts

const VENDOR_CODES = ["VENDOR1", "VENDOR4", "VENDOR5", "VENDOR3", "VENDOR2"];
const PROBLEM_TOKENS = /\b(red|critical|below target|behind|spike|drop|issue|error|failed|blocked|gap|miss(?:ed|ing)?)\b/i;
const KPI_TOKENS = /\b(MetricA|MetricB|MetricC|KPI|Buyability|Coverage|Availability|Forecast)\b/i;
const VENDOR_TOKEN_RE = new RegExp(`\\b(${VENDOR_CODES.join("|")})\\b`, "g");

const SEED_FALLBACK = [
  "Show me the next thing I should do",
  "What did I work on yesterday?",
  "Catch me up on Slack mentions",
  "Something else",
];

/**
 * Generate up to N chip strings.
 * @param {object} ctx
 * @param {string} ctx.assistantText — last assistant turn text
 * @param {string} ctx.userText      — most recent genuine user turn
 * @param {Array}  ctx.toolNames     — names of tools called this turn
 * @param {number} [ctx.max=4]
 * @returns {string[]}
 */
export function suggestNextActions(ctx = {}) {
  const { assistantText = "", userText = "", toolNames = [], max = 4 } = ctx;
  const chips = [];
  const text = `${userText}\n${assistantText}`;

  // Extract vendor mentions (deduped, ordered by first appearance).
  const seenVendor = new Set();
  let m;
  while ((m = VENDOR_TOKEN_RE.exec(text)) !== null) {
    if (!seenVendor.has(m[1])) seenVendor.add(m[1]);
  }
  VENDOR_TOKEN_RE.lastIndex = 0;
  const vendors = [...seenVendor];

  // Extract a KPI mention if present.
  const kpiMatch = text.match(KPI_TOKENS);
  const kpi = kpiMatch ? kpiMatch[0] : null;

  // 1. PROBLEM chip — when the assistant flagged something red.
  if (PROBLEM_TOKENS.test(assistantText) && vendors.length) {
    const v = vendors[0];
    chips.push(kpi
      ? `Deep dive ${v} ${kpi} — root cause + dispute plan`
      : `Deep dive ${v} — root cause + action plan`);
  }

  // 2. NEXT-VENDOR chip — only when 2+ vendors mentioned.
  if (vendors.length >= 2) {
    const v = vendors[1];
    chips.push(kpi
      ? `${v} ${kpi} gap — what can we push for next month?`
      : `${v} performance — what's the priority action?`);
  }

  // 3. EMAIL chip — when problems exist + a vendor is named.
  if (PROBLEM_TOKENS.test(assistantText) && vendors.length) {
    const v = vendors[0];
    chips.push(`Draft an update email to my manager on ${v} status`);
  }

  // 4. RECORD chip — when we've done meaningful tool work.
  if (toolNames.length >= 3 && chips.length < max) {
    chips.push("Save this workflow as a skill for next time");
  }

  // Always close with "Something else" so the user has an out.
  if (chips.length >= 1 && chips.length < max) {
    chips.push("Something else");
  }

  // Fallback when zero useful chips fired.
  if (chips.length === 0) return SEED_FALLBACK.slice(0, max);

  return chips.slice(0, max);
}

export const _internals = { VENDOR_CODES, PROBLEM_TOKENS, KPI_TOKENS, SEED_FALLBACK };
