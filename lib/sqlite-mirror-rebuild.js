// Phase Q-pass-5 P1-5 — Rebuild the SQLite mirror from JSONL truth.
//
// Triggered by:
//   1. Boot when ~/.ares/mirror.db.lock exists (unclean shutdown)
//   2. Boot when mirror.db is missing entirely
//   3. Manual: `node scripts/mirror-rebuild.mjs --force`
//
// Strategy: stream every JSONL/JSON file in source-of-truth order,
// upsert each row, force-flush at the end, stamp a clean shutdown.
// Idempotent — re-running with no truth changes is a near-no-op
// because every upsert hits ON CONFLICT.
//
// Sources (in order; partial failure on one file does NOT abort the rest):
//   - sessions/*.json                              → conversations + messages
//   - ~/.kiro/memory/journal.jsonl                 → memory_entries
//   - ~/.ares/knowledge-graph.jsonl                → kg_nodes + kg_edges
//   - ~/.ares/feed-state.json                      → feed_items (read state only;
//                                                    items themselves are ephemeral)
//
// Scheduled tasks live in jobs.db (an existing SQLite). We don't
// re-mirror them here — the existing job-runner already writes through.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  openMirror, flushAndStat,
  upsertConversation, upsertMemoryEntry,
  upsertKgNode, upsertKgEdge, upsertFeedItem,
} from "./sqlite-mirror.js";

const SESSIONS_DIR_DEFAULT = path.join(
  process.env.ARES_WORKSPACE || process.cwd(),
  "sessions",
);
const MEMORY_FILE = path.join(os.homedir(), ".kiro", "memory", "journal.jsonl");
const KG_FILE = path.join(os.homedir(), ".ares", "knowledge-graph.jsonl");
const FEED_STATE_FILE = path.join(os.homedir(), ".ares", "feed-state.json");

/**
 * Rebuild from truth. Returns a summary.
 * @param {object} opts
 * @param {string} [opts.sessionsDir] — override session directory
 * @param {function} [opts.log]       — logger; defaults to console.log
 */
export async function rebuildFromJsonl({ sessionsDir = SESSIONS_DIR_DEFAULT, log = console.log } = {}) {
  const start = Date.now();
  openMirror();
  const summary = {
    sessions: { scanned: 0, upserted: 0, errors: 0 },
    memory:   { scanned: 0, upserted: 0, errors: 0 },
    kg:       { nodes: 0, edges: 0, errors: 0 },
    feed:     { upserted: 0, errors: 0 },
    durationMs: 0,
  };

  // ─── Sessions ────────────────────────────────────────────────────
  try {
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      summary.sessions.scanned += 1;
      try {
        const raw = fs.readFileSync(path.join(sessionsDir, f), "utf8");
        if (!raw || raw.length < 5) continue;
        const session = JSON.parse(raw);
        if (!session?.id) continue;
        session._sourceFile = path.join(sessionsDir, f);
        upsertConversation(session);
        summary.sessions.upserted += 1;
      } catch (err) {
        summary.sessions.errors += 1;
        log(`[mirror-rebuild] session ${f} skipped: ${err.message}`);
      }
    }
  } catch (err) {
    log(`[mirror-rebuild] sessions dir scan failed: ${err.message}`);
  }

  // ─── Memory journal ──────────────────────────────────────────────
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const raw = fs.readFileSync(MEMORY_FILE, "utf8");
      const lines = raw.split("\n").filter(Boolean);
      for (const line of lines) {
        summary.memory.scanned += 1;
        try {
          const entry = JSON.parse(line);
          upsertMemoryEntry(entry);
          summary.memory.upserted += 1;
        } catch (err) {
          summary.memory.errors += 1;
        }
      }
    }
  } catch (err) {
    log(`[mirror-rebuild] memory scan failed: ${err.message}`);
  }

  // ─── Knowledge graph ─────────────────────────────────────────────
  try {
    if (fs.existsSync(KG_FILE)) {
      const raw = fs.readFileSync(KG_FILE, "utf8");
      const lines = raw.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j.kind === "node") { upsertKgNode(j); summary.kg.nodes += 1; }
          else if (j.kind === "edge") { upsertKgEdge(j); summary.kg.edges += 1; }
        } catch {
          summary.kg.errors += 1;
        }
      }
    }
  } catch (err) {
    log(`[mirror-rebuild] kg scan failed: ${err.message}`);
  }

  // ─── Feed read-state (only the dismissed/read flags persist) ──────
  // The actual feed items are ephemeral — generated on each poll. We
  // still mirror the "dismissed" set so the UI's hide-list survives.
  try {
    if (fs.existsSync(FEED_STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(FEED_STATE_FILE, "utf8"));
      for (const id of state.dismissed || []) {
        upsertFeedItem({ id, source: "unknown", dismissed: true, createdAt: 0 });
        summary.feed.upserted += 1;
      }
    }
  } catch (err) {
    log(`[mirror-rebuild] feed state scan failed: ${err.message}`);
    summary.feed.errors += 1;
  }

  // Force-flush everything queued.
  const stat = flushAndStat();
  summary.durationMs = Date.now() - start;
  log(
    `[mirror-rebuild] done in ${summary.durationMs}ms — ` +
    `${summary.sessions.upserted} sessions, ${summary.memory.upserted} memory, ` +
    `${summary.kg.nodes} kg-nodes, ${summary.kg.edges} kg-edges, ` +
    `${summary.feed.upserted} feed-state. ` +
    `Final counts: ${JSON.stringify(stat?.counts)}`
  );
  return { summary, stat };
}
