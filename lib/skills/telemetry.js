// Phase U11 — skills telemetry.
//
// Tracks every skill_search → skill_save / skill_record_run flow so we can
// answer two operator-facing questions:
//   1. Hit rate — what % of skill_search calls produced a skill_run that
//      the agent actually used?
//   2. Failure modes — which queries return zero hits, which skills get
//      run but never recorded as success?
//
// Storage: append-only JSONL at ~/.kiro/cache/skills-telemetry.jsonl. One
// line per event. Cheap, grep-friendly, no new deps.
//
// We never block the hot path on telemetry — failures log + continue.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TELEMETRY_DIR = path.join(os.homedir(), ".kiro", "cache");
const TELEMETRY_PATH = path.join(TELEMETRY_DIR, "skills-telemetry.jsonl");
const ROLLUP_CAP = 1000; // events to keep in-memory for /api/skills/telemetry

const _events = []; // ring buffer for the HTTP probe

function append(event) {
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true, mode: 0o700 });
    fs.appendFileSync(TELEMETRY_PATH, JSON.stringify(event) + "\n");
  } catch {
    // best-effort
  }
  _events.push(event);
  if (_events.length > ROLLUP_CAP) _events.shift();
}

/**
 * Record a skill tool invocation. Called from the hub's observation
 * point AFTER the underlying MCP returned. Result is normalised so
 * downstream rollups don't have to know about MCP content blocks.
 *
 * kind: "search" | "save" | "record_run"
 */
export function recordSkillEvent({ kind, args, result, durationMs }) {
  const entry = {
    ts: Date.now(),
    kind,
    args: trimArgs(args),
    durationMs: typeof durationMs === "number" ? durationMs : null,
  };
  if (kind === "search") {
    entry.hitCount = countSearchHits(result);
    entry.zeroHits = entry.hitCount === 0;
  } else if (kind === "record_run") {
    entry.success = !!(args?.success);
    entry.slug = args?.slug || null;
  } else if (kind === "save") {
    entry.slug = parseSavedSlug(result) || args?.title || null;
    entry.isError = !!result?.isError;
  }
  append(entry);
  return entry;
}

function trimArgs(args) {
  if (!args || typeof args !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (Array.isArray(v)) out[k] = v.slice(0, 8).map((x) => String(x).slice(0, 80));
    else if (typeof v === "object") out[k] = "[object]";
    else out[k] = v;
  }
  return out;
}

function countSearchHits(result) {
  if (!result?.content) return 0;
  for (const b of result.content) {
    if (b?.type !== "text" || typeof b.text !== "string") continue;
    // skill_search returns a JSON array on the first text block.
    try {
      const parsed = JSON.parse(b.text);
      if (Array.isArray(parsed)) return parsed.length;
      if (Array.isArray(parsed?.results)) return parsed.results.length;
    } catch {}
    // fallback heuristic — count "title:" markers
    const m = b.text.match(/title:/g);
    if (m) return m.length;
  }
  return 0;
}

function parseSavedSlug(result) {
  if (!result?.content) return null;
  for (const b of result.content) {
    if (b?.type !== "text" || typeof b.text !== "string") continue;
    const m = b.text.match(/slug[":\s]+["']?([\w-]+)["']?/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Roll up the in-memory ring buffer. Returned shape is intentionally
 * compact — the HTTP probe is meant to drive a small dashboard tile,
 * not a SIEM.
 */
export function rollup() {
  const searches = _events.filter((e) => e.kind === "search");
  const saves    = _events.filter((e) => e.kind === "save");
  const runs     = _events.filter((e) => e.kind === "record_run");
  const successfulRuns = runs.filter((r) => r.success).length;
  return {
    counts: {
      events: _events.length,
      searches: searches.length,
      saves: saves.length,
      runs: runs.length,
      successfulRuns,
    },
    rates: {
      zeroHitSearchRate: searches.length
        ? Math.round((searches.filter((s) => s.zeroHits).length / searches.length) * 100) / 100
        : null,
      runSuccessRate: runs.length
        ? Math.round((successfulRuns / runs.length) * 100) / 100
        : null,
    },
    recent: _events.slice(-30),
    storagePath: TELEMETRY_PATH,
  };
}

/** Test hook — clears the in-memory buffer (NOT the on-disk JSONL). */
export function _resetForTests() {
  _events.length = 0;
}
