// Debug-bot finding store. One row per distinct bug finding, keyed by a
// stable fingerprint so the same issue across runs updates a single row
// instead of spamming duplicates. Lives in sessions/jobs.db (same file as
// the jobs runner) so it ships with the existing WAL + backup story.
//
// Lifecycle of a finding's `status`:
//   detected     → just found, no action yet
//   fixing       → fixer is mid-attempt (transient)
//   auto_fixed   → fixer applied a change AND re-verify passed
//   reverted     → fixer applied a change, re-verify FAILED, change rolled back
//   needs_user   → risky / ambiguous; a proposed diff is attached, awaiting apply
//   dismissed    → user dismissed it
//   resolved     → no longer detected on a later run (auto-closed)

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

let db = null;

export function openBugStore(sessionsDir) {
  if (db) return db;
  fs.mkdirSync(sessionsDir, { recursive: true });
  db = new Database(path.join(sessionsDir, "jobs.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS bug_findings (
      id            TEXT PRIMARY KEY,
      fingerprint   TEXT UNIQUE NOT NULL,
      layer         TEXT NOT NULL,      -- logs | backend | tests | frontend | ui-ux | architecture
      severity      TEXT NOT NULL,      -- critical | high | medium | low
      title         TEXT NOT NULL,
      detail        TEXT,               -- human-readable description / evidence
      file          TEXT,               -- primary file, if known
      status        TEXT NOT NULL,      -- see lifecycle above
      risk          TEXT,               -- safe | risky (drives auto-fix gating)
      proposed_diff TEXT,               -- unified diff or change description for needs_user
      fix_summary   TEXT,               -- what the fixer actually did
      first_seen    INTEGER NOT NULL,
      last_seen     INTEGER NOT NULL,
      resolved_at   INTEGER,
      run_id        TEXT,               -- the debug-bot run that last touched it
      seen_count    INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_bug_status ON bug_findings(status, last_seen DESC);
    CREATE INDEX IF NOT EXISTS idx_bug_layer  ON bug_findings(layer, last_seen DESC);
  `);
  return db;
}

export function fingerprint({ layer, title, file }) {
  return crypto
    .createHash("sha1")
    .update(`${layer}::${file || ""}::${title}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Upsert a finding. If the fingerprint exists we bump last_seen + seen_count
 * and refresh mutable fields, but we DO NOT clobber a terminal status
 * (auto_fixed / dismissed / needs_user) — those are owned by the fixer / user.
 * Returns the row (post-write).
 */
export function upsertFinding(sessionsDir, f) {
  openBugStore(sessionsDir);
  const fp = fingerprint(f);
  const now = Date.now();
  const existing = db.prepare(`SELECT * FROM bug_findings WHERE fingerprint = ?`).get(fp);
  if (existing) {
    // Reopen a previously-resolved finding if it shows up again.
    const reopen = existing.status === "resolved";
    db.prepare(`
      UPDATE bug_findings SET
        last_seen = ?, seen_count = seen_count + 1,
        severity = ?, title = ?, detail = ?, layer = ?, file = ?,
        run_id = ?, resolved_at = NULL,
        status = CASE WHEN ? THEN 'detected' ELSE status END
      WHERE fingerprint = ?
    `).run(now, f.severity, f.title, f.detail || null, f.layer, f.file || null,
           f.runId || null, reopen ? 1 : 0, fp);
    return getFinding(fp);
  }
  const id = `bug_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`
    INSERT INTO bug_findings
      (id, fingerprint, layer, severity, title, detail, file, status, risk,
       first_seen, last_seen, run_id, seen_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'detected', ?, ?, ?, ?, 1)
  `).run(id, fp, f.layer, f.severity, f.title, f.detail || null, f.file || null,
         f.risk || null, now, now, f.runId || null);
  return getFinding(fp);
}

export function getFinding(idOrFp) {
  openBugStore();
  return db.prepare(
    `SELECT * FROM bug_findings WHERE id = ? OR fingerprint = ?`
  ).get(idOrFp, idOrFp) || null;
}

export function setFindingStatus(id, patch) {
  openBugStore();
  const cur = getFinding(id);
  if (!cur) return null;
  db.prepare(`
    UPDATE bug_findings SET
      status = COALESCE(?, status),
      risk = COALESCE(?, risk),
      proposed_diff = COALESCE(?, proposed_diff),
      fix_summary = COALESCE(?, fix_summary),
      last_seen = ?
    WHERE id = ?
  `).run(
    patch.status ?? null,
    patch.risk ?? null,
    patch.proposedDiff ?? null,
    patch.fixSummary ?? null,
    Date.now(),
    cur.id,
  );
  return getFinding(cur.id);
}

/**
 * Mark every still-open (detected) finding from a layer that was NOT seen in
 * the current run as resolved. Called per-layer after a clean check so cards
 * auto-close. Does not touch needs_user / auto_fixed / dismissed.
 */
export function resolveStale(sessionsDir, { layer, seenFingerprints, runId }) {
  openBugStore(sessionsDir);
  const now = Date.now();
  const rows = db.prepare(
    `SELECT id, fingerprint FROM bug_findings WHERE layer = ? AND status = 'detected'`
  ).all(layer);
  let resolved = 0;
  for (const r of rows) {
    if (!seenFingerprints.has(r.fingerprint)) {
      db.prepare(`UPDATE bug_findings SET status = 'resolved', resolved_at = ?, run_id = ? WHERE id = ?`)
        .run(now, runId || null, r.id);
      resolved++;
    }
  }
  return resolved;
}

export function listFindings({ status, layer, limit = 200 } = {}) {
  openBugStore();
  const clauses = [];
  const args = [];
  if (status) { clauses.push("status = ?"); args.push(status); }
  if (layer)  { clauses.push("layer = ?");  args.push(layer); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(
    `SELECT * FROM bug_findings ${where} ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       last_seen DESC
     LIMIT ?`
  ).all(...args, limit);
  return rows.map(parseRow);
}

export function findingStats() {
  openBugStore();
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'auto_fixed' THEN 1 ELSE 0 END) AS autoFixed,
      SUM(CASE WHEN status = 'needs_user' THEN 1 ELSE 0 END) AS needsUser,
      SUM(CASE WHEN status = 'detected'   THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'reverted'   THEN 1 ELSE 0 END) AS reverted,
      COUNT(*) AS total
    FROM bug_findings
  `).get();
  return {
    autoFixed: row.autoFixed || 0,
    needsUser: row.needsUser || 0,
    open: row.open || 0,
    reverted: row.reverted || 0,
    total: row.total || 0,
  };
}

function parseRow(row) {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    layer: row.layer,
    severity: row.severity,
    title: row.title,
    detail: row.detail,
    file: row.file,
    status: row.status,
    risk: row.risk,
    proposedDiff: row.proposed_diff,
    fixSummary: row.fix_summary,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    resolvedAt: row.resolved_at,
    runId: row.run_id,
    seenCount: row.seen_count,
  };
}
