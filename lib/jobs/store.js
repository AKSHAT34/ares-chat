// SQLite-backed run history for /api/jobs.
// One row per run. Tool calls + per-action policy verdicts are inlined as JSON
// so the UI can render the run detail without a join. SQLite, not Postgres,
// because everything else in ares-chat is local-first SQLite.

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

let db = null;

export function openStore(sessionsDir) {
  if (db) return db;
  fs.mkdirSync(sessionsDir, { recursive: true });
  db = new Database(path.join(sessionsDir, "jobs.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,
      trigger TEXT NOT NULL,
      summary TEXT,
      stats_json TEXT,
      log_json TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_job ON runs(job_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS job_state (
      job_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      cron TEXT,
      last_run_at INTEGER,
      last_status TEXT,
      config_json TEXT
    );

    CREATE TABLE IF NOT EXISTS runner_state (
      k TEXT PRIMARY KEY,
      v TEXT
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      target TEXT,
      verdict TEXT NOT NULL,
      summary TEXT,
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_actions_run ON actions(run_id);
    CREATE INDEX IF NOT EXISTS idx_actions_job_ts ON actions(job_id, ts DESC);

    -- Phase U08 — user-defined jobs running the generic agent handler.
    -- Sits alongside the static JOBS registry in lib/jobs/registry.js.
    -- The runner concatenates both lists each tick. Schema kept narrow
    -- on purpose: prompt, model tier, MCP allowlist, delivery target,
    -- skill autoload toggle. No bespoke per-job code.
    CREATE TABLE IF NOT EXISTS dynamic_jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      cron TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'sonnet',
      mcps_json TEXT NOT NULL DEFAULT '[]',
      attach_skills INTEGER NOT NULL DEFAULT 1,
      deliver_kind TEXT NOT NULL DEFAULT 'browser-toast',
      deliver_target TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

// ─── Phase U08 — dynamic-jobs CRUD ───

export function listDynamicJobs() {
  openStore();
  const rows = db.prepare(`SELECT * FROM dynamic_jobs ORDER BY created_at DESC`).all();
  return rows.map(parseDynamicJobRow);
}

export function getDynamicJob(id) {
  openStore();
  const row = db.prepare(`SELECT * FROM dynamic_jobs WHERE id = ?`).get(id);
  return row ? parseDynamicJobRow(row) : null;
}

export function upsertDynamicJob(job) {
  openStore();
  const now = Date.now();
  const id = job.id || `dj_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const existing = db.prepare(`SELECT id FROM dynamic_jobs WHERE id = ?`).get(id);
  const mcpsJson = JSON.stringify(Array.isArray(job.mcps) ? job.mcps : []);
  if (existing) {
    db.prepare(`
      UPDATE dynamic_jobs SET
        title = ?, description = ?, cron = ?, enabled = ?,
        prompt = ?, model = ?, mcps_json = ?, attach_skills = ?,
        deliver_kind = ?, deliver_target = ?, updated_at = ?
      WHERE id = ?
    `).run(
      job.title, job.description || "", job.cron,
      job.enabled === false ? 0 : 1,
      job.prompt, job.model || "sonnet", mcpsJson,
      job.attachSkills === false ? 0 : 1,
      job.deliver?.kind || "browser-toast", job.deliver?.target || null,
      now, id,
    );
  } else {
    db.prepare(`
      INSERT INTO dynamic_jobs (
        id, title, description, cron, enabled,
        prompt, model, mcps_json, attach_skills,
        deliver_kind, deliver_target, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, job.title, job.description || "", job.cron,
      job.enabled === false ? 0 : 1,
      job.prompt, job.model || "sonnet", mcpsJson,
      job.attachSkills === false ? 0 : 1,
      job.deliver?.kind || "browser-toast", job.deliver?.target || null,
      now, now,
    );
  }
  return getDynamicJob(id);
}

export function deleteDynamicJob(id) {
  openStore();
  const r = db.prepare(`DELETE FROM dynamic_jobs WHERE id = ?`).run(id);
  return r.changes > 0;
}

function parseDynamicJobRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    cron: row.cron,
    enabled: row.enabled === 1,
    prompt: row.prompt,
    model: row.model,
    mcps: JSON.parse(row.mcps_json || "[]"),
    attachSkills: row.attach_skills === 1,
    deliver: { kind: row.deliver_kind, target: row.deliver_target },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDynamic: true,
  };
}

export function recordRunStart({ id, jobId, trigger }) {
  openStore();
  db.prepare(
    `INSERT INTO runs (id, job_id, started_at, status, trigger) VALUES (?, ?, ?, 'running', ?)`
  ).run(id, jobId, Date.now(), trigger);
}

export function recordRunFinish({ id, status, summary, stats, log, error }) {
  openStore();
  db.prepare(
    `UPDATE runs SET finished_at = ?, status = ?, summary = ?, stats_json = ?, log_json = ?, error = ? WHERE id = ?`
  ).run(
    Date.now(),
    status,
    summary || null,
    stats ? JSON.stringify(stats) : null,
    log ? JSON.stringify(log) : null,
    error || null,
    id
  );
}

// B-34: atomic completion — wrap recordRunFinish + setJobLastRun in a
// single SQL transaction so a crash between them can't leave a
// "completed" run with no last_run timestamp on the job_state row.
// Pre-fix the two updates ran sequentially with no transaction.
export function recordRunFinishAtomic({ id, jobId, status, summary, stats, log, error }) {
  openStore();
  // Ensure job_state row exists so the UPDATE has a target.
  const exists = db.prepare(`SELECT job_id FROM job_state WHERE job_id = ?`).get(jobId);
  if (!exists) {
    db.prepare(`INSERT INTO job_state (job_id, enabled, cron) VALUES (?, 1, NULL)`).run(jobId);
  }
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE runs SET finished_at = ?, status = ?, summary = ?, stats_json = ?, log_json = ?, error = ? WHERE id = ?`
    ).run(
      Date.now(),
      status,
      summary || null,
      stats ? JSON.stringify(stats) : null,
      log ? JSON.stringify(log) : null,
      error || null,
      id
    );
    db.prepare(`UPDATE job_state SET last_run_at = ?, last_status = ? WHERE job_id = ?`)
      .run(Date.now(), status, jobId);
  });
  tx();
}

export function recordAction({ runId, jobId, kind, target, verdict, summary, payload }) {
  openStore();
  db.prepare(
    `INSERT INTO actions (run_id, job_id, ts, kind, target, verdict, summary, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    runId,
    jobId,
    Date.now(),
    kind,
    target || null,
    verdict,
    summary || null,
    payload ? JSON.stringify(payload) : null
  );
}

export function listRuns({ jobId, limit = 50 }) {
  openStore();
  const stmt = jobId
    ? db.prepare(`SELECT * FROM runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?`)
    : db.prepare(`SELECT * FROM runs ORDER BY started_at DESC LIMIT ?`);
  const rows = jobId ? stmt.all(jobId, limit) : stmt.all(limit);
  return rows.map(parseRunRow);
}

export function getRun(runId) {
  openStore();
  const row = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId);
  if (!row) return null;
  const parsed = parseRunRow(row);
  parsed.actions = db.prepare(`SELECT * FROM actions WHERE run_id = ? ORDER BY ts ASC`).all(runId).map(parseActionRow);
  return parsed;
}

export function listActionsSince({ jobId, sinceMs }) {
  openStore();
  const cutoff = Date.now() - sinceMs;
  const stmt = jobId
    ? db.prepare(`SELECT * FROM actions WHERE job_id = ? AND ts >= ? ORDER BY ts DESC`)
    : db.prepare(`SELECT * FROM actions WHERE ts >= ? ORDER BY ts DESC`);
  const rows = jobId ? stmt.all(jobId, cutoff) : stmt.all(cutoff);
  return rows.map(parseActionRow);
}

export function getJobState(jobId) {
  openStore();
  return db.prepare(`SELECT * FROM job_state WHERE job_id = ?`).get(jobId) || null;
}

export function upsertJobState({ jobId, enabled, cron, config }) {
  openStore();
  const existing = getJobState(jobId);
  if (existing) {
    db.prepare(`UPDATE job_state SET enabled = COALESCE(?, enabled), cron = COALESCE(?, cron), config_json = COALESCE(?, config_json) WHERE job_id = ?`)
      .run(enabled == null ? null : enabled ? 1 : 0, cron || null, config ? JSON.stringify(config) : null, jobId);
  } else {
    db.prepare(`INSERT INTO job_state (job_id, enabled, cron, config_json) VALUES (?, ?, ?, ?)`)
      .run(jobId, enabled == null ? 1 : (enabled ? 1 : 0), cron || null, config ? JSON.stringify(config) : null);
  }
}

export function setJobLastRun({ jobId, status }) {
  openStore();
  upsertJobState({ jobId, enabled: null });
  db.prepare(`UPDATE job_state SET last_run_at = ?, last_status = ? WHERE job_id = ?`).run(Date.now(), status, jobId);
}

export function getRunnerMeta(key) {
  openStore();
  const row = db.prepare(`SELECT v FROM runner_state WHERE k = ?`).get(key);
  return row?.v ?? null;
}

export function setRunnerMeta(key, value) {
  openStore();
  db.prepare(`INSERT INTO runner_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`)
    .run(key, value == null ? null : String(value));
}

function parseRunRow(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    trigger: row.trigger,
    summary: row.summary,
    stats: row.stats_json ? safeParse(row.stats_json) : null,
    log: row.log_json ? safeParse(row.log_json) : null,
    error: row.error,
  };
}

function parseActionRow(row) {
  return {
    id: row.id,
    runId: row.run_id,
    jobId: row.job_id,
    ts: row.ts,
    kind: row.kind,
    target: row.target,
    verdict: row.verdict,
    summary: row.summary,
    payload: row.payload_json ? safeParse(row.payload_json) : null,
  };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
