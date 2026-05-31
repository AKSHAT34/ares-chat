// Session-scoped RAG store.
//
// Two-tier memory architecture:
//   - This module: per-session full-transcript index. Every user/assistant
//     turn pair gets indexed automatically. Used to retrieve relevant past
//     turns when the model asks about something that's been compressed out
//     of the working window. Lives at sessions/<sid>.rag.db.
//
//   - Central memory MCP (~/.kiro/memory/): cross-session task journal.
//     Stores significant outcomes promoted automatically by the auto-promote
//     hook in server.js. Used to remember things across sessions.
//
// Why both: the central store is for "what did I do about X two weeks ago",
// while the session store is for "earlier in this 500-turn conversation
// you said Y". Different jobs, different stores.
//
// Storage format:
//   - SQLite database, one file per session: sessions/<sid>.rag.db
//   - FTS5 virtual table for keyword search (fast, zero-cost lookup)
//   - sqlite-vec virtual table for embedding search (semantic recall)
//   - Embeddings via the same MiniLM-L6 model the central memory uses
//     (lazy-loaded, ~25 MB one-time download)

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "node:path";
import fs from "node:fs";

// Lazy embedder — loaded on first use, shared across sessions.
let _embedderPromise = null;
async function getEmbed() {
  if (_embedderPromise) return _embedderPromise;
  _embedderPromise = (async () => {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = true;
    env.useBrowserCache = false;
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true });
    return async (text) => {
      const out = await extractor(text, { pooling: "mean", normalize: true });
      return Array.from(out.data); // 384 floats
    };
  })();
  return _embedderPromise;
}

// D-12: per-session DB cache with an LRU cap. Pre-fix this Map was
// unbounded — every session ever queried left 3 file descriptors open
// (db / wal / shm) until process exit. macOS default ulimit is 256, so
// a long-running server with many sessions could exhaust FDs.
//
// LRU: keyed by sessionId, oldest-at-insertion-bottom (Map preserves
// insertion order). On every access we delete-then-set to bump to the
// most-recent end. On insert past the cap we close + delete the oldest.
const _DBS_LRU_CAP = parseInt(process.env.ARES_RAG_DB_CACHE_CAP || "32", 10);
const _dbs = new Map();

function dbPath(sessionsDir, sid) {
  return path.join(sessionsDir, `${sid}.rag.db`);
}

function _touchLru(sid) {
  const cur = _dbs.get(sid);
  if (cur === undefined) return undefined;
  // Re-insert to move to most-recent end.
  _dbs.delete(sid);
  _dbs.set(sid, cur);
  return cur;
}

function _evictOldestIfNeeded() {
  while (_dbs.size > _DBS_LRU_CAP) {
    // Map insertion-order iterator — first key is the LRU entry.
    const oldestSid = _dbs.keys().next().value;
    const cached = _dbs.get(oldestSid);
    _dbs.delete(oldestSid);
    if (cached) { try { cached.close(); } catch {} }
  }
}

// Closes every cached DB (e.g. on SIGTERM). Idempotent.
export function closeAllRagDbs() {
  for (const [sid, db] of _dbs) {
    try { db.close(); } catch {}
  }
  _dbs.clear();
}

function openDb(sessionsDir, sid) {
  const cached = _touchLru(sid);
  if (cached) return cached;
  fs.mkdirSync(sessionsDir, { recursive: true });
  const db = new Database(dbPath(sessionsDir, sid));
  db.pragma("journal_mode = WAL");
  db.defaultSafeIntegers(false);
  sqliteVec.load(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS turns (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      ts INTEGER NOT NULL,
      text TEXT NOT NULL,
      tools TEXT
    );
    CREATE INDEX IF NOT EXISTS turns_seq_idx ON turns(seq);
    CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
      text, role UNINDEXED, content='turns', content_rowid='rowid', tokenize='porter unicode61'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS turns_vec USING vec0(
      embedding FLOAT[384]
    );
    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY, v TEXT
    );
  `);
  _dbs.set(sid, db);
  _evictOldestIfNeeded();
  return db;
}

// Test helper — drains the cache without touching disk.
export function _resetRagCacheForTests() {
  closeAllRagDbs();
}

// Test introspection — current cached size + ordered keys (LRU first).
export function _ragCacheStateForTests() {
  return { size: _dbs.size, keys: [..._dbs.keys()], cap: _DBS_LRU_CAP };
}

/**
 * Extract a flat searchable string + tool-name list from an Anthropic
 * Messages-format content array (or string).
 */
function flattenContent(content) {
  if (typeof content === "string") return { text: content, tools: [] };
  if (!Array.isArray(content)) return { text: "", tools: [] };
  const texts = [];
  const tools = [];
  for (const b of content) {
    if (b?.type === "text" && typeof b.text === "string") {
      texts.push(b.text);
    } else if (b?.type === "tool_use" && b.name) {
      tools.push(b.name);
      try { texts.push(`[tool_use:${b.name}] ${JSON.stringify(b.input || {}).slice(0, 600)}`); } catch {}
    } else if (b?.type === "tool_result") {
      const inner = typeof b.content === "string"
        ? b.content
        : Array.isArray(b.content)
          ? b.content.map((c) => c?.text || "").join("\n")
          : "";
      // Truncate big tool results to keep the index lean.
      texts.push(`[tool_result] ${inner.slice(0, 4000)}`);
    }
  }
  return { text: texts.join("\n").slice(0, 16000), tools };
}

/**
 * Append a turn to the session's RAG index. Cheap and idempotent: if the
 * exact (seq, role, text) tuple is already stored we skip. Embeddings are
 * computed lazily — if the embedder isn't ready yet we still index the
 * FTS row so keyword search works immediately, and the vector is filled
 * in on a best-effort basis.
 */
export async function indexTurn({ sessionsDir, sessionId, seq, role, content, ts = Date.now() }) {
  if (!sessionId) return;
  const { text, tools } = flattenContent(content);
  if (!text || text.length < 8) return; // nothing useful to index
  const db = openDb(sessionsDir, sessionId);

  // Idempotency: skip if same (seq, role) pair already exists. We allow
  // re-indexing of the same seq with a different role (user/assistant
  // pair) because both halves share the seq number in our caller.
  const existing = db.prepare("SELECT rowid FROM turns WHERE seq = ? AND role = ?").get(seq, role);
  if (existing) return;

  const insert = db.prepare(`
    INSERT INTO turns (seq, role, ts, text, tools) VALUES (?, ?, ?, ?, ?)
  `);
  const info = insert.run(seq, role, ts, text, JSON.stringify(tools));
  const rowid = Number(info.lastInsertRowid);

  db.prepare("INSERT INTO turns_fts(rowid, text, role) VALUES (?, ?, ?)")
    .run(rowid, text, role);

  // Embedding — best effort. Don't block indexing if the model fails.
  try {
    const embed = await getEmbed();
    const vec = await embed(text.slice(0, 4000));
    db.prepare("INSERT INTO turns_vec(rowid, embedding) VALUES (?, ?)")
      .run(rowid, new Float32Array(vec));
  } catch (err) {
    // Vector index optional; FTS is enough for keyword recall.
  }
}

/**
 * Search the session RAG. Returns a list of past turns ranked by relevance.
 * Hybrid retrieval: FTS5 BM25 + cosine similarity, results merged.
 *
 * Excludes turns at or after `excludeFromSeq` so we don't retrieve the
 * very turn the user just typed (or anything still in the working
 * transcript that the agent already has).
 */
export async function searchSession({ sessionsDir, sessionId, query, k = 6, excludeFromSeq = null }) {
  if (!sessionId || !query) return [];
  const dbFile = dbPath(sessionsDir, sessionId);
  if (!fs.existsSync(dbFile) && !_dbs.has(sessionId)) return [];
  const db = openDb(sessionsDir, sessionId);

  const exclude = excludeFromSeq != null ? "AND turns.seq < ?" : "";
  const excludeArg = excludeFromSeq != null ? [excludeFromSeq] : [];

  // FTS half. We sanitize the query to make FTS5 happy: drop punctuation
  // that breaks tokenization, keep word-ish runs, OR them together.
  const ftsQuery = query
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 12)
    .join(" OR ") || "x";

  const ftsRows = (() => {
    try {
      return db.prepare(`
        SELECT turns.rowid, turns.seq, turns.role, turns.ts, turns.text,
               bm25(turns_fts) AS score
        FROM turns_fts
        JOIN turns ON turns.rowid = turns_fts.rowid
        WHERE turns_fts MATCH ? ${exclude}
        ORDER BY score
        LIMIT ?
      `).all(ftsQuery, ...excludeArg, k * 2);
    } catch {
      return [];
    }
  })();

  // Vector half. Skip silently if the embedder isn't ready or the vec
  // table has no rows yet.
  let vecRows = [];
  try {
    const embed = await getEmbed();
    const qvec = await embed(query.slice(0, 2000));
    vecRows = db.prepare(`
      SELECT turns.rowid, turns.seq, turns.role, turns.ts, turns.text,
             distance AS score
      FROM turns_vec
      JOIN turns ON turns.rowid = turns_vec.rowid
      WHERE embedding MATCH ? ${exclude}
      ORDER BY distance
      LIMIT ?
    `).all(new Float32Array(qvec), ...excludeArg, k * 2);
  } catch {
    vecRows = [];
  }

  // Reciprocal rank fusion — cheap, robust, no tuning.
  const merged = new Map();
  const RRF_K = 60;
  ftsRows.forEach((r, i) => {
    const cur = merged.get(r.rowid) || { ...r, _score: 0 };
    cur._score += 1 / (RRF_K + i);
    merged.set(r.rowid, cur);
  });
  vecRows.forEach((r, i) => {
    const cur = merged.get(r.rowid) || { ...r, _score: 0 };
    cur._score += 1 / (RRF_K + i);
    merged.set(r.rowid, cur);
  });
  const ranked = Array.from(merged.values())
    .sort((a, b) => b._score - a._score)
    .slice(0, k);

  return ranked.map(({ _score, ...row }) => row);
}

/** Total indexed turns in this session. */
export function countTurns({ sessionsDir, sessionId }) {
  if (!sessionId) return 0;
  const dbFile = dbPath(sessionsDir, sessionId);
  if (!fs.existsSync(dbFile) && !_dbs.has(sessionId)) return 0;
  const db = openDb(sessionsDir, sessionId);
  return db.prepare("SELECT COUNT(*) AS n FROM turns").get().n;
}

/** Drop the session DB. Called when a session is deleted. */
export function dropSession({ sessionsDir, sessionId }) {
  const cached = _dbs.get(sessionId);
  if (cached) { try { cached.close(); } catch {} _dbs.delete(sessionId); }
  for (const ext of ["", "-wal", "-shm"]) {
    const p = dbPath(sessionsDir, sessionId) + ext;
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  }
}

/** Index every turn in a freshly-loaded session. Used on first send so
 *  pre-existing transcripts get indexed lazily. */
export async function reindexSession({ sessionsDir, sessionId, messages }) {
  if (!Array.isArray(messages)) return;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m?.role || !m?.content) continue;
    await indexTurn({
      sessionsDir,
      sessionId,
      seq: i,
      role: m.role,
      content: m.content,
      ts: m.ts || Date.now(),
    });
  }
}

/**
 * List every session id that currently has a .rag.db on disk. Cheap —
 * filesystem scan only, no DB opens.
 */
export function listIndexedSessions({ sessionsDir }) {
  try {
    return fs.readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".rag.db"))
      .map((f) => f.replace(/\.rag\.db$/, ""));
  } catch {
    return [];
  }
}

/**
 * Backfill: walk every session JSON, build (or top up) its .rag.db.
 * Idempotent because indexTurn dedupes on (seq, role). Returns counts
 * so the boot path can log progress.
 */
export async function backfillAllSessions({ sessionsDir, log = console.log }) {
  let scanned = 0, built = 0, skipped = 0, errors = 0, totalTurns = 0;
  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    scanned++;
    const sid = file.replace(/\.json$/, "");
    const ragFile = path.join(sessionsDir, `${sid}.rag.db`);
    const hadRag = fs.existsSync(ragFile);
    try {
      const raw = fs.readFileSync(path.join(sessionsDir, file), "utf8");
      if (!raw || raw.length < 20) { skipped++; continue; }
      const data = JSON.parse(raw);
      const msgs = data.messages || [];
      if (!msgs.length) { skipped++; continue; }
      const before = countTurns({ sessionsDir, sessionId: sid });
      await reindexSession({ sessionsDir, sessionId: sid, messages: msgs });
      const after = countTurns({ sessionsDir, sessionId: sid });
      const delta = after - before;
      totalTurns += delta;
      if (!hadRag) built++;
      if (delta > 0 && hadRag) log(`[session-rag] backfill ${sid.slice(0,8)} +${delta} turns`);
      else if (!hadRag) log(`[session-rag] backfill ${sid.slice(0,8)} created (${after} turns)`);
    } catch (err) {
      errors++;
      log(`[session-rag] backfill ${sid.slice(0,8)} failed: ${err.message}`);
    }
  }
  return { scanned, built, skipped, errors, totalTurns };
}

/**
 * Search across EVERY indexed session. For each session DB, run the same
 * hybrid retrieval as searchSession, then RRF-merge across sessions and
 * cap to k. Returns hits annotated with sessionId so the caller can deep-link.
 *
 * sinceMs / untilMs filter on turn timestamp (ms epoch).
 */
export async function searchAcrossSessions({
  sessionsDir,
  query,
  k = 12,
  sinceMs = null,
  untilMs = null,
  excludeSessionId = null,
}) {
  if (!query) return [];
  const sids = listIndexedSessions({ sessionsDir });
  if (!sids.length) return [];
  const all = [];
  // D-13: bounded-concurrency parallel search. Pre-fix the loop was
  // serial: each session opened a DB and ran an FTS+vec query before
  // the next one started. With many sessions this stretched to seconds.
  // Cap concurrency at 4 — enough to overlap I/O without blowing past
  // the LRU cap (D-12 caps at 32, so 4 in-flight × 8× turnover is safe).
  const targets = sids.filter((sid) => !(excludeSessionId && sid === excludeSessionId));
  const CONCURRENCY = 4;
  let cursor = 0;
  async function _worker() {
    while (cursor < targets.length) {
      const sid = targets[cursor++];
      try {
        const hits = await searchSession({ sessionsDir, sessionId: sid, query, k });
        for (const h of hits) {
          if (sinceMs != null && h.ts < sinceMs) continue;
          if (untilMs != null && h.ts > untilMs) continue;
          all.push({ ...h, sessionId: sid });
        }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, _worker));
  all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  // Re-score by combining recency + relevance heuristic — relevance was
  // already filtered by per-session top-k, so a simple recency-weighted
  // dedupe across sessions is good enough.
  return all.slice(0, k);
}
