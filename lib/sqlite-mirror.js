// Phase Q-pass-5 P1-5 — SQLite write-through mirror.
//
// JSONL files (sessions/*.json, ~/.kiro/memory/journal.jsonl,
// ~/.ares/knowledge-graph.jsonl, ~/.ares/feed-state.json) remain the
// SOURCE OF TRUTH. This module mirrors every write into a single
// indexed SQLite database so:
//
//   - cross-session search is O(log n) instead of O(n) JSON.parse
//   - the spec §12.1 schema is satisfied for any future direct-SQL
//     consumer (Q-UI Activity feed, future analytics jobs)
//   - boot-time "rebuild from JSONL" is idempotent — if the SQLite
//     file goes missing or drifts, we re-import every JSONL line and
//     produce the exact same table state
//
// Drift mitigation:
//   - Every row carries `source_hash` = SHA-1 of the JSONL line that
//     produced it. On rebuild, we skip any row whose hash already
//     matches the JSONL line, so re-imports are O(N) without
//     redundant deletes.
//   - Each table has a `mirrored_at` timestamp so a stale row can be
//     refreshed even if the JSONL line changed.
//   - WAL mode keeps writers + readers concurrent; the mirror never
//     blocks the JSONL write.
//
// What's NOT in scope:
//   - The mirror is WRITE-THROUGH ONLY for now. Reads still go through
//     the existing JSONL parsers. A follow-up phase will flip read
//     paths to use the mirror once Q-pass-5 lands and the rebuild
//     script has run a full cycle on real data.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const MIRROR_DIR = path.join(os.homedir(), ".ares");
const MIRROR_FILE = process.env.ARES_MIRROR_FILE
  || path.join(MIRROR_DIR, "mirror.db");
const LOCK_FILE = MIRROR_FILE + ".lock";

let _db = null;
let _writeQueue = [];
let _flushTimer = null;
const FLUSH_INTERVAL_MS = 250; // batch writes to ride one transaction

// ─── Schema (mirrors spec §12.1) ───────────────────────────────────
//
// Schema is intentionally a SUPERSET of the spec — we add `source_hash`,
// `source_file`, `mirrored_at` to every table so rebuild stays cheap.

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    message_count INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    branched_from_session_id TEXT,
    branched_from_message_idx INTEGER,
    source_hash TEXT,
    source_file TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_branched ON conversations(branched_from_session_id)`,

  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    content_text TEXT,
    created_at INTEGER,
    has_tool_use INTEGER DEFAULT 0,
    has_tool_result INTEGER DEFAULT 0,
    source_hash TEXT,
    mirrored_at INTEGER,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_msg_conv_seq ON messages(conversation_id, seq)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    message_id TEXT,
    name TEXT,
    type TEXT,
    size_bytes INTEGER,
    path TEXT,
    created_at INTEGER,
    source_hash TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_art_conv ON artifacts(conversation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_art_created ON artifacts(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    cron TEXT,
    prompt_template TEXT,
    mcps_json TEXT,
    enabled INTEGER DEFAULT 1,
    last_run_at INTEGER,
    last_status TEXT,
    source_hash TEXT,
    source_file TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_task_enabled ON scheduled_tasks(enabled)`,

  `CREATE TABLE IF NOT EXISTS kg_nodes (
    id TEXT PRIMARY KEY,
    type TEXT,
    label TEXT,
    properties_json TEXT,
    summary TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    source_hash TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kg_node_type ON kg_nodes(type)`,
  `CREATE INDEX IF NOT EXISTS idx_kg_node_label ON kg_nodes(label COLLATE NOCASE)`,

  `CREATE TABLE IF NOT EXISTS kg_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation TEXT,
    confidence REAL DEFAULT 1.0,
    source_hash TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kg_edge_source ON kg_edges(source_id)`,
  `CREATE INDEX IF NOT EXISTS idx_kg_edge_target ON kg_edges(target_id)`,

  `CREATE TABLE IF NOT EXISTS feed_items (
    id TEXT PRIMARY KEY,
    type TEXT,
    source TEXT,
    title TEXT,
    body TEXT,
    importance TEXT,
    relevance REAL,
    relevance_reason TEXT,
    handled INTEGER DEFAULT 0,
    dismissed INTEGER DEFAULT 0,
    created_at INTEGER,
    source_hash TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feed_source ON feed_items(source)`,
  `CREATE INDEX IF NOT EXISTS idx_feed_created ON feed_items(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_feed_relevance ON feed_items(relevance DESC)`,

  // memory_entries — mirror of ~/.kiro/memory/journal.jsonl. Kept as
  // text+tags for cross-search; full vector embeddings stay in
  // ~/.kiro/memory/vectors.db owned by memory-mcp.
  `CREATE TABLE IF NOT EXISTS memory_entries (
    id TEXT PRIMARY KEY,
    kind TEXT,
    summary TEXT,
    details TEXT,
    outcome TEXT,
    tags_json TEXT,
    created_at INTEGER,
    source_hash TEXT,
    mirrored_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mem_kind ON memory_entries(kind)`,
  `CREATE INDEX IF NOT EXISTS idx_mem_created ON memory_entries(created_at DESC)`,

  // Mirror health — single-row table tracks last clean shutdown,
  // schema version, JSONL line counts at last full sync.
  `CREATE TABLE IF NOT EXISTS mirror_health (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    schema_version INTEGER NOT NULL,
    last_clean_shutdown INTEGER,
    last_full_rebuild INTEGER,
    sessions_lines_at_last_sync INTEGER DEFAULT 0,
    memory_lines_at_last_sync INTEGER DEFAULT 0,
    kg_lines_at_last_sync INTEGER DEFAULT 0
  )`,
];

const SCHEMA_VERSION = 1;

// ─── Lock + lifecycle ──────────────────────────────────────────────

function _ensureDir() {
  try { fs.mkdirSync(MIRROR_DIR, { recursive: true, mode: 0o700 }); } catch {}
}

function _hash(str) {
  return crypto.createHash("sha1").update(String(str)).digest("hex");
}

/**
 * Open or create the mirror DB. Idempotent. If a stale lock file is
 * present (from a prior unclean shutdown), the caller should run
 * `rebuildFromJsonl()` after open() to re-sync. We DON'T auto-rebuild
 * here because it can be expensive and the caller decides timing.
 */
export function openMirror() {
  if (_db) return _db;
  _ensureDir();
  _db = new Database(MIRROR_FILE);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("temp_store = MEMORY");
  for (const stmt of SCHEMA_STATEMENTS) _db.exec(stmt);
  // Seed mirror_health row if missing.
  const existing = _db.prepare("SELECT 1 FROM mirror_health WHERE id = 1").get();
  if (!existing) {
    _db.prepare(`INSERT INTO mirror_health (id, schema_version, last_clean_shutdown)
                 VALUES (1, ?, NULL)`).run(SCHEMA_VERSION);
  }
  // Stamp lock file so we can detect unclean shutdown next boot.
  try { fs.writeFileSync(LOCK_FILE, String(process.pid), { mode: 0o600 }); } catch {}
  return _db;
}

/**
 * Was the last shutdown clean? Returns true if `mirror_health.last_clean_shutdown`
 * is set AND the lock file is absent. Triggers rebuild on false.
 */
export function wasCleanShutdown() {
  if (!_db) openMirror();
  const row = _db.prepare("SELECT last_clean_shutdown FROM mirror_health WHERE id = 1").get();
  const lockExists = fs.existsSync(LOCK_FILE);
  // Note: openMirror() ALWAYS writes the lock, so checking it AFTER open()
  // tells you nothing. The check must happen BEFORE openMirror() is
  // called. The right pattern is: callers do
  //   const wasClean = !fs.existsSync(LOCK_FILE);  openMirror();
  // and pass `wasClean` into rebuildFromJsonl(). We expose this helper
  // for symmetry but the caller should use the file-existence check.
  return !!row?.last_clean_shutdown && !lockExists;
}

/**
 * Mark this shutdown as clean. Call from server.js's gracefulShutdown()
 * before exiting so next boot doesn't trigger rebuild.
 */
export function markCleanShutdown() {
  if (!_db) return;
  _flushNow();
  try {
    _db.prepare("UPDATE mirror_health SET last_clean_shutdown = ? WHERE id = 1")
       .run(Date.now());
  } catch {}
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

export function closeMirror() {
  if (!_db) return;
  markCleanShutdown();
  try { _db.close(); } catch {}
  _db = null;
}

// ─── Write-through API ─────────────────────────────────────────────
//
// Every upsert is buffered into a queue and flushed in a single
// transaction every FLUSH_INTERVAL_MS. Callers don't await; the queue
// is unbounded but capped via _writeQueue.length check so a runaway
// caller can't OOM.

function _enqueue(op) {
  _writeQueue.push(op);
  if (_writeQueue.length > 5000) {
    // Backpressure: flush immediately to avoid memory growth.
    _flushNow();
    return;
  }
  if (!_flushTimer) {
    _flushTimer = setTimeout(_flushNow, FLUSH_INTERVAL_MS);
  }
}

function _flushNow() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  if (!_writeQueue.length || !_db) return;
  const ops = _writeQueue;
  _writeQueue = [];
  const tx = _db.transaction((items) => {
    for (const op of items) {
      try { op(); } catch (err) {
        // Per-op failure logged but doesn't kill the batch.
        console.warn("[mirror] op failed:", err.message);
      }
    }
  });
  try { tx(ops); } catch (err) {
    console.warn("[mirror] flush transaction failed:", err.message);
  }
}

/**
 * Force-flush + return a snapshot of last-sync stats. Used by
 * /api/mirror/stats and the test suite.
 */
export function flushAndStat() {
  _flushNow();
  if (!_db) return null;
  const counts = {
    conversations: _db.prepare("SELECT COUNT(*) AS n FROM conversations").get().n,
    messages:      _db.prepare("SELECT COUNT(*) AS n FROM messages").get().n,
    artifacts:     _db.prepare("SELECT COUNT(*) AS n FROM artifacts").get().n,
    scheduled:     _db.prepare("SELECT COUNT(*) AS n FROM scheduled_tasks").get().n,
    kg_nodes:      _db.prepare("SELECT COUNT(*) AS n FROM kg_nodes").get().n,
    kg_edges:      _db.prepare("SELECT COUNT(*) AS n FROM kg_edges").get().n,
    feed_items:    _db.prepare("SELECT COUNT(*) AS n FROM feed_items").get().n,
    memory:        _db.prepare("SELECT COUNT(*) AS n FROM memory_entries").get().n,
  };
  const health = _db.prepare("SELECT * FROM mirror_health WHERE id = 1").get();
  return {
    file: MIRROR_FILE,
    schemaVersion: SCHEMA_VERSION,
    counts,
    health,
    queueLen: _writeQueue.length,
  };
}

// ─── Per-table writers ─────────────────────────────────────────────

export function upsertConversation(session) {
  if (!_db) openMirror();
  const sourceHash = _hash(JSON.stringify({ id: session.id, t: session.title, u: session.updatedAt }));
  _enqueue(() => {
    _db.prepare(`INSERT INTO conversations
      (id, title, created_at, updated_at, message_count, pinned,
       branched_from_session_id, branched_from_message_idx,
       source_hash, source_file, mirrored_at)
      VALUES (@id, @title, @createdAt, @updatedAt, @messageCount, @pinned,
              @branchedFromSessionId, @branchedFromMessageIdx,
              @sourceHash, @sourceFile, @mirroredAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at,
        message_count = excluded.message_count,
        pinned = excluded.pinned,
        branched_from_session_id = excluded.branched_from_session_id,
        branched_from_message_idx = excluded.branched_from_message_idx,
        source_hash = excluded.source_hash,
        mirrored_at = excluded.mirrored_at`).run({
      id: session.id,
      title: session.title || null,
      createdAt: session.createdAt || null,
      updatedAt: session.updatedAt || Date.now(),
      messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
      pinned: session.pinned ? 1 : 0,
      branchedFromSessionId: session.branchedFrom?.parentSessionId || null,
      branchedFromMessageIdx: session.branchedFrom?.parentMessageIdx ?? null,
      sourceHash,
      sourceFile: session._sourceFile || null,
      mirroredAt: Date.now(),
    });
    // Mirror messages too — bounded scan, idempotent because PK is
    // (sessionId, seq). We don't dump huge tool-results; just metadata
    // + first 4KB of text per message.
    if (Array.isArray(session.messages)) {
      const stmt = _db.prepare(`INSERT INTO messages
        (id, conversation_id, seq, role, content_text, created_at, has_tool_use, has_tool_result, source_hash, mirrored_at)
        VALUES (@id, @conv, @seq, @role, @text, @ts, @hasUse, @hasRes, @hash, @mAt)
        ON CONFLICT(id) DO UPDATE SET
          content_text = excluded.content_text,
          has_tool_use = excluded.has_tool_use,
          has_tool_result = excluded.has_tool_result,
          source_hash = excluded.source_hash,
          mirrored_at = excluded.mirrored_at`);
      for (let seq = 0; seq < session.messages.length; seq++) {
        const m = session.messages[seq];
        if (!m || !m.role) continue;
        let text = "";
        let hasUse = 0, hasRes = 0;
        if (typeof m.content === "string") text = m.content;
        else if (Array.isArray(m.content)) {
          for (const b of m.content) {
            if (b?.type === "text") text += (b.text || "") + "\n";
            else if (b?.type === "tool_use") hasUse = 1;
            else if (b?.type === "tool_result") hasRes = 1;
          }
        }
        stmt.run({
          id: `${session.id}:${seq}`,
          conv: session.id,
          seq,
          role: m.role,
          text: text.slice(0, 4096),
          ts: m.ts || session.updatedAt || null,
          hasUse,
          hasRes,
          hash: _hash(text + ":" + hasUse + ":" + hasRes),
          mAt: Date.now(),
        });
      }
    }
  });
}

export function deleteConversation(sessionId) {
  if (!_db) openMirror();
  _enqueue(() => {
    _db.prepare("DELETE FROM conversations WHERE id = ?").run(sessionId);
    _db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(sessionId);
    _db.prepare("DELETE FROM artifacts WHERE conversation_id = ?").run(sessionId);
  });
}

export function upsertScheduledTask(task) {
  if (!_db) openMirror();
  _enqueue(() => {
    _db.prepare(`INSERT INTO scheduled_tasks
      (id, title, cron, prompt_template, mcps_json, enabled, last_run_at, last_status,
       source_hash, source_file, mirrored_at)
      VALUES (@id, @title, @cron, @prompt, @mcps, @enabled, @lastRun, @lastStatus,
              @hash, @file, @mAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        cron = excluded.cron,
        prompt_template = excluded.prompt_template,
        mcps_json = excluded.mcps_json,
        enabled = excluded.enabled,
        last_run_at = excluded.last_run_at,
        last_status = excluded.last_status,
        source_hash = excluded.source_hash,
        mirrored_at = excluded.mirrored_at`).run({
      id: task.id,
      title: task.title || null,
      cron: task.cron || null,
      prompt: task.promptTemplate || task.prompt || null,
      mcps: JSON.stringify(task.mcps || []),
      enabled: task.enabled === false ? 0 : 1,
      lastRun: task.lastRunAt || null,
      lastStatus: task.lastStatus || null,
      hash: _hash(JSON.stringify(task)),
      file: task._sourceFile || null,
      mAt: Date.now(),
    });
  });
}

export function deleteScheduledTask(taskId) {
  if (!_db) openMirror();
  _enqueue(() => {
    _db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(taskId);
  });
}

export function upsertKgNode(node) {
  if (!_db) openMirror();
  _enqueue(() => {
    _db.prepare(`INSERT INTO kg_nodes
      (id, type, label, properties_json, summary, created_at, updated_at, source_hash, mirrored_at)
      VALUES (@id, @type, @label, @props, @summary, @createdAt, @updatedAt, @hash, @mAt)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        label = excluded.label,
        properties_json = excluded.properties_json,
        summary = excluded.summary,
        updated_at = excluded.updated_at,
        source_hash = excluded.source_hash,
        mirrored_at = excluded.mirrored_at`).run({
      id: node.id,
      type: node.type || null,
      label: node.label || null,
      props: JSON.stringify(node.properties || {}),
      summary: node.summary || null,
      createdAt: node.createdAt || Date.now(),
      updatedAt: node.updatedAt || Date.now(),
      hash: _hash(JSON.stringify(node)),
      mAt: Date.now(),
    });
  });
}

export function upsertKgEdge(edge) {
  if (!_db) openMirror();
  const id = edge.id || _hash(`${edge.from}>${edge.relation}>${edge.to}`);
  _enqueue(() => {
    _db.prepare(`INSERT INTO kg_edges
      (id, source_id, target_id, relation, confidence, source_hash, mirrored_at)
      VALUES (@id, @from, @to, @rel, @conf, @hash, @mAt)
      ON CONFLICT(id) DO UPDATE SET
        relation = excluded.relation,
        confidence = excluded.confidence,
        source_hash = excluded.source_hash,
        mirrored_at = excluded.mirrored_at`).run({
      id,
      from: edge.from || edge.source_id,
      to: edge.to || edge.target_id,
      rel: edge.relation || null,
      conf: edge.confidence ?? 1.0,
      hash: _hash(JSON.stringify(edge)),
      mAt: Date.now(),
    });
  });
}

export function upsertFeedItem(item) {
  if (!_db) openMirror();
  _enqueue(() => {
    _db.prepare(`INSERT INTO feed_items
      (id, type, source, title, body, importance, relevance, relevance_reason,
       handled, dismissed, created_at, source_hash, mirrored_at)
      VALUES (@id, @type, @source, @title, @body, @importance, @relevance, @relevanceReason,
              @handled, @dismissed, @createdAt, @hash, @mAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        importance = excluded.importance,
        relevance = excluded.relevance,
        relevance_reason = excluded.relevance_reason,
        handled = excluded.handled,
        dismissed = excluded.dismissed,
        source_hash = excluded.source_hash,
        mirrored_at = excluded.mirrored_at`).run({
      id: item.id,
      type: item.type || null,
      source: item.source || null,
      title: item.title || null,
      body: (item.body || "").slice(0, 4096),
      importance: item.importance || null,
      relevance: typeof item.relevance === "number" ? item.relevance : null,
      relevanceReason: item.relevanceReason || null,
      handled: item.handled ? 1 : 0,
      dismissed: item.dismissed ? 1 : 0,
      createdAt: item.ts || item.createdAt || Date.now(),
      hash: _hash(JSON.stringify(item)),
      mAt: Date.now(),
    });
  });
}

export function upsertMemoryEntry(entry) {
  if (!_db) openMirror();
  _enqueue(() => {
    const id = entry.id || _hash(`${entry.timestamp}:${entry.summary}`);
    _db.prepare(`INSERT INTO memory_entries
      (id, kind, summary, details, outcome, tags_json, created_at, source_hash, mirrored_at)
      VALUES (@id, @kind, @summary, @details, @outcome, @tags, @createdAt, @hash, @mAt)
      ON CONFLICT(id) DO UPDATE SET
        summary = excluded.summary,
        details = excluded.details,
        outcome = excluded.outcome,
        tags_json = excluded.tags_json,
        source_hash = excluded.source_hash,
        mirrored_at = excluded.mirrored_at`).run({
      id,
      kind: entry.kind || null,
      summary: entry.summary || null,
      details: (entry.details || "").slice(0, 16384),
      outcome: entry.outcome || null,
      tags: typeof entry.tags === "string" ? entry.tags : JSON.stringify(entry.tags || []),
      createdAt: typeof entry.timestamp === "string"
        ? new Date(entry.timestamp).getTime()
        : (entry.timestamp || Date.now()),
      hash: _hash(JSON.stringify(entry)),
      mAt: Date.now(),
    });
  });
}

// ─── Read helpers (used by /api/mirror/stats + tests) ─────────────

export function listConversations({ limit = 50 } = {}) {
  if (!_db) openMirror();
  _flushNow();
  return _db.prepare(
    "SELECT id, title, updated_at, message_count, pinned, branched_from_session_id FROM conversations ORDER BY updated_at DESC LIMIT ?"
  ).all(limit);
}

export function searchConversations(query, { limit = 50 } = {}) {
  if (!_db) openMirror();
  _flushNow();
  const q = `%${String(query).replace(/%/g, "")}%`;
  return _db.prepare(
    `SELECT DISTINCT c.id, c.title, c.updated_at
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.title LIKE ? OR m.content_text LIKE ?
     ORDER BY c.updated_at DESC LIMIT ?`
  ).all(q, q, limit);
}

export function listFeedItems({ source = null, sinceMs = 0, limit = 100 } = {}) {
  if (!_db) openMirror();
  _flushNow();
  let where = "WHERE created_at >= ? AND dismissed = 0";
  const params = [sinceMs];
  if (source) { where += " AND source = ?"; params.push(source); }
  return _db.prepare(
    `SELECT * FROM feed_items ${where} ORDER BY created_at DESC LIMIT ?`
  ).all(...params, limit);
}

export function searchKnowledge(query, { type = null, limit = 30 } = {}) {
  if (!_db) openMirror();
  _flushNow();
  const q = `%${String(query).replace(/%/g, "")}%`;
  let where = "WHERE label LIKE ? COLLATE NOCASE";
  const params = [q];
  if (type) { where += " AND type = ?"; params.push(type); }
  return _db.prepare(
    `SELECT id, type, label, summary FROM kg_nodes ${where} ORDER BY length(label) ASC LIMIT ?`
  ).all(...params, limit);
}

export const _internals = {
  MIRROR_FILE,
  LOCK_FILE,
  SCHEMA_VERSION,
  _hash,
  _flushNow,
};
