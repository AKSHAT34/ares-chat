// Q-pass-4 (work-stream E) — empty-state suggestion chips for the Q
// composer. Merges three sources:
//
//   1. memory_smart_recall — pulls top topics surfaced from the recent
//      cross-session journal. Surfaces "Catch up on <topic>" prompts
//      that map to the user's actual recent activity.
//   2. skills__skill_list — picks the top 3 most-run learned skills.
//      Surfaces "Run the <skill> playbook" prompts so the user can
//      replay verified workflows in one click.
//   3. A fixed seed list — universal evergreen prompts ("What can Ares
//      do?", "Catch me up on what I missed today", etc.). These always
//      appear so a fresh install with no memory/skills isn't blank.
//
// Result is sliced to 5 chips total. Each chip has `kind` so the UI can
// render them differently if it wants. Cached for 60 seconds in-memory
// to spare the MCP backends — the empty state can render multiple times
// per session and we don't need fresh data every render.
//
// Cache eviction: pure time-based TTL. We don't bother with LRU/size
// limits because the cache is a single global slot — there is exactly
// one /api/suggestions response at any time. A second hit within the TTL
// reuses it; the first hit after the TTL re-fetches synchronously.

const CACHE_TTL_MS = 60_000;
const TARGET_TOTAL = 5;
const TOP_SKILLS = 3;
const TOP_MEMORY = 3;
// MCP tool calls can hang on cold-spawn or a stale AuthProvider cookie. The
// empty-state should never block the chat surface for more than 1.5s
// — fall through to seeds if memory or skills don't answer in time.
const MCP_TIMEOUT_MS = 1500;

function _withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (v) => { if (done) return; done = true; clearTimeout(timer); resolve(v); },
      () => { if (done) return; done = true; clearTimeout(timer); resolve(fallback); },
    );
  });
}

// Evergreen seed prompts — drawn from to fill any remaining slots after
// memory + skills contribute. Ordered most-useful-first; we slice off the
// top.
const SEED_SUGGESTIONS = [
  "What can Ares do?",
  "Catch me up on what I missed today",
  "Show me my recent sessions",
  "Search my knowledge graph",
  "What's on my schedule today?",
];

let _cache = null; // { ts, suggestions }

function _now() { return Date.now(); }

/**
 * Best-effort parse — most of our MCP tools return content[0].text as a
 * JSON-encoded payload. Some return {hits:[…]}, some return arrays
 * directly. Tolerate both shapes; on parse failure return [].
 */
function _parseMcpJson(result) {
  try {
    const text = (result?.content || [])
      .filter((b) => b?.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function _fetchMemoryTopics(hub) {
  try {
    const r = await hub.callTool("memory__memory_smart_recall", {
      query: "topics I've worked on recently",
      limit: TOP_MEMORY * 2,
    });
    const parsed = _parseMcpJson(r);
    const hits = Array.isArray(parsed?.hits) ? parsed.hits : (Array.isArray(parsed) ? parsed : []);
    const topics = [];
    const seen = new Set();
    for (const h of hits) {
      const summary = (h?.summary || h?.text || h?.title || "").trim();
      if (!summary) continue;
      // Use the first ~50 chars to dedupe; a smart_recall query can
      // surface 3 hits from the same project and we only want one chip.
      const key = summary.slice(0, 50).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      topics.push(summary.length > 80 ? summary.slice(0, 77) + "…" : summary);
      if (topics.length >= TOP_MEMORY) break;
    }
    return topics.map((t) => ({ text: `Catch up on ${t}`, kind: "memory" }));
  } catch {
    return [];
  }
}

async function _fetchTopSkills(hub) {
  try {
    const r = await hub.callTool("skills__skill_list", {});
    const parsed = _parseMcpJson(r);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.skills) ? parsed.skills : []);
    return list
      .map((s) => ({ title: s?.title || s?.slug || "", runs: Number(s?.run_count || 0) }))
      .filter((s) => s.title)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, TOP_SKILLS)
      .map((s) => ({ text: `Run the ${s.title} playbook`, kind: "skill" }));
  } catch {
    return [];
  }
}

/**
 * Build a fresh suggestion list. Pulls memory + skills via the hub,
 * then fills the rest from seeds. Always returns TARGET_TOTAL chips
 * unless the seed list itself is shorter (it isn't).
 */
async function _build({ hub }) {
  const [mem, skills] = await Promise.all([
    hub ? _withTimeout(_fetchMemoryTopics(hub), MCP_TIMEOUT_MS, []) : Promise.resolve([]),
    hub ? _withTimeout(_fetchTopSkills(hub), MCP_TIMEOUT_MS, []) : Promise.resolve([]),
  ]);
  const out = [];
  // Memory first — most personal. Then skills — most actionable.
  for (const c of mem) { if (out.length < TARGET_TOTAL) out.push(c); }
  for (const c of skills) { if (out.length < TARGET_TOTAL) out.push(c); }
  // Fill the remainder with seeds.
  for (const text of SEED_SUGGESTIONS) {
    if (out.length >= TARGET_TOTAL) break;
    out.push({ text, kind: "seed" });
  }
  return out;
}

/**
 * Return the cached suggestion list if it's still fresh, else rebuild.
 * Exposed so server.js can wire `app.get("/api/suggestions", …)`.
 */
export async function getSuggestions({ hub }) {
  const now = _now();
  if (_cache && now - _cache.ts < CACHE_TTL_MS) {
    return { suggestions: _cache.suggestions, cached: true };
  }
  const suggestions = await _build({ hub });
  _cache = { ts: now, suggestions };
  return { suggestions, cached: false };
}

/** Wipe the cache — used by tests to exercise miss → hit transitions. */
export function _clearCache() { _cache = null; }

/** Inspect the cache state — tests assert TTL behaviour through this. */
export function _peekCache() { return _cache ? { ...{ ts: _cache.ts }, suggestions: [..._cache.suggestions] } : null; }

export const _CONSTANTS = { CACHE_TTL_MS, TARGET_TOTAL, TOP_SKILLS, TOP_MEMORY, SEED_SUGGESTIONS };
