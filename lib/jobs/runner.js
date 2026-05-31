// Job runner. Polls every minute, fires due handlers, persists results.
// Each run gets a fresh JobContext (logger, MCP hub, bedrockFactory, store
// recorders, policy classifier) so handlers don't need to import singletons.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { parseCron } from "./cron.js";
import { JOBS, getJob } from "./registry.js";
import {
  openStore,
  recordRunStart,
  recordRunFinish, // kept for tests + future per-step writes
  recordRunFinishAtomic,
  recordAction,
  setJobLastRun,
  upsertJobState,
  getJobState,
  getRunnerMeta,
  setRunnerMeta,
  listDynamicJobs,
  getDynamicJob,
} from "./store.js";
import { classifyToolCall, getPolicy } from "./policy.js";
import { runAgentJob } from "./handlers/agent.js";

export class JobRunner {
  constructor({ hub, bedrockFactory, sessionsDir, systemPrompt = "", log = console.log }) {
    this.hub = hub;
    this.bedrockFactory = bedrockFactory;
    this.sessionsDir = sessionsDir;
    this.systemPrompt = systemPrompt;
    this.log = log;
    this.parsed = new Map();          // jobId -> parsed cron
    this.timer = null;
    this.activeRuns = new Set();      // jobIds currently executing
    // B-29: jobIds whose cron tick fired while a previous run was still
    // active. We re-fire each one immediately when the previous run
    // finishes (status doesn't matter — completed, failed, or timeout
    // all trigger). Pre-fix the missed slot was silently dropped, and
    // the catch-up branch only kicked in after a >90s gap.
    this.pendingImmediate = new Set();
    // B-31: DST dedupe. cron parser uses local time, so on the fall-back
    // hour (e.g. 02:30 happens twice on the day clocks go back) a job
    // would fire twice. Track the last `<jobId>:<minuteKey>` we fired,
    // skip if we'd fire the same key again. minuteKey is local-time
    // YYYY-MM-DD-HH-MM, so a wall-clock minute that "happens twice" is
    // still only one key — first match fires, second match is dropped.
    this.lastFiredMinuteKey = new Map();
    // Cap so the map doesn't grow unbounded over the process lifetime.
    // 12 months × 31 jobs = ~372 entries worst case; cap at 1000.
    this._lastFiredCap = 1000;
    // Phase U08 — emits run lifecycle events so server.js can fan them
    // out on the /api/jobs/events SSE endpoint. Listeners receive
    // { type: "started"|"completed"|"failed", jobId, runId, summary?, stats?, error? }.
    this.events = new EventEmitter();
    this.events.setMaxListeners(50);
  }

  /** Concatenated view of static + dynamic jobs. */
  _allJobs() {
    return [...JOBS, ...this._dynamicAsJobs()];
  }

  _dynamicAsJobs() {
    let dyn;
    try { dyn = listDynamicJobs(); } catch { return []; }
    return dyn.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      defaultCron: d.cron,
      model: d.model,
      mcps: d.mcps || [],
      isDynamic: true,
      _spec: d,
      handler: (ctx) => runAgentJob(
        { ...ctx, _systemPrompt: this.systemPrompt },
        { title: d.title, prompt: d.prompt, model: d.model, mcps: d.mcps, attachSkills: d.attachSkills, deliver: d.deliver },
      ),
    }));
  }

  _findJob(jobId) {
    return this._allJobs().find((j) => j.id === jobId) || null;
  }

  start() {
    openStore(this.sessionsDir);
    const all = this._allJobs();
    for (const job of all) {
      const state = getJobState(job.id);
      const cron = state?.cron || job.defaultCron;
      if (!state) upsertJobState({ jobId: job.id, enabled: true, cron });
      this.parsed.set(job.id, parseCron(cron));
    }
    const dynCount = all.length - JOBS.length;
    this.log(`[jobs] runner started — ${JOBS.length} static + ${dynCount} dynamic job(s) registered`);
    // Tick at the top of each minute (with small jitter so two runners
    // started in the same second don't collide on the same MCP).
    const drift = 1500 + Math.floor(Math.random() * 2000);
    this.timer = setInterval(() => this.tick().catch((e) => this.log(`[jobs] tick error: ${e.message}`)), 60 * 1000);
    setTimeout(() => this.tick().catch(() => {}), drift);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    const now = new Date();
    now.setSeconds(0, 0);
    const nowMs = now.getTime();

    // Catch-up: detect a sleep / suspension gap. If we haven't ticked in
    // > 90 s, walk every minute we missed and fire ONE catch-up per job
    // whose cron would have matched at any point in the gap. Catch-up runs
    // are tagged trigger="catchup" so the brief / UI can distinguish them.
    const lastTickRaw = getRunnerMeta("last_tick_at");
    const lastTickMs = lastTickRaw ? parseInt(lastTickRaw, 10) : null;
    if (lastTickMs && nowMs - lastTickMs > 90 * 1000) {
      const gapMin = Math.round((nowMs - lastTickMs) / 60000);
      this.log(`[jobs] tick gap detected — ${gapMin} min since last tick. Running catch-up.`);
      const missedByJob = new Map();
      // Iterate minute boundaries strictly between lastTickMs and now (exclusive
      // of now itself — that's handled by the regular branch below).
      const cursor = new Date(lastTickMs + 60 * 1000);
      cursor.setSeconds(0, 0);
      let safety = 0;
      const allJobs = this._allJobs();
      while (cursor.getTime() < nowMs && safety < 60 * 24 * 7) {  // cap = 1 week
        for (const job of allJobs) {
          const state = getJobState(job.id);
          if (!state || state.enabled !== 1) continue;
          const parsed = this.parsed.get(job.id);
          if (parsed?.matches(cursor)) missedByJob.set(job.id, cursor.getTime());
        }
        cursor.setMinutes(cursor.getMinutes() + 1);
        safety++;
      }
      // B-32: cap catch-up concurrency. Pre-fix all missed jobs fired
      // in parallel via runJob().catch(...) — after a 12-hour sleep that
      // could be 7 simultaneous handlers each opening Bedrock streams +
      // activating MCPs. Now: serialise via a tiny await loop so each
      // handler completes (or at least starts holding activeRuns)
      // before the next one fires.
      for (const [jobId, missedAt] of missedByJob) {
        if (this.activeRuns.has(jobId)) continue;
        const ageMin = Math.round((nowMs - missedAt) / 60000);
        this.log(`[jobs] ${jobId} catch-up — missed slot was ${ageMin} min ago`);
        try {
          await this.runJob(jobId, "catchup");
        } catch (e) {
          this.log(`[jobs] ${jobId} catchup error: ${e.message}`);
        }
      }
    }

    // Normal tick — fire any job whose cron matches the current minute.
    // Refresh the parsed cron map for any newly-added dynamic jobs.
    const allJobs = this._allJobs();
    for (const job of allJobs) {
      if (!this.parsed.has(job.id)) {
        const state = getJobState(job.id);
        const cron = state?.cron || job.defaultCron;
        if (!state) upsertJobState({ jobId: job.id, enabled: true, cron });
        try { this.parsed.set(job.id, parseCron(cron)); } catch {}
      }
    }
    for (const job of allJobs) {
      const state = getJobState(job.id);
      if (!state || state.enabled !== 1) continue;
      const parsed = this.parsed.get(job.id);
      if (!parsed?.matches(now)) continue;
      // B-31: DST dedupe — skip if we already fired this job at the
      // current local-time minute (covers fall-back ambiguity).
      const minuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      const lastKey = this.lastFiredMinuteKey.get(job.id);
      if (lastKey === minuteKey) continue;
      if (this.activeRuns.has(job.id)) {
        // B-29: queue an immediate re-run when the in-flight one finishes.
        // Pre-fix the slot was just logged-and-dropped.
        this.pendingImmediate.add(job.id);
        this.log(`[jobs] ${job.id} skipped — previous run still active; queued`);
        continue;
      }
      this.lastFiredMinuteKey.set(job.id, minuteKey);
      // Cap eviction (FIFO via Map iteration order).
      if (this.lastFiredMinuteKey.size > this._lastFiredCap) {
        const firstKey = this.lastFiredMinuteKey.keys().next().value;
        this.lastFiredMinuteKey.delete(firstKey);
      }
      this.runJob(job.id, "schedule").catch((e) => this.log(`[jobs] ${job.id} runJob error: ${e.message}`));
    }

    setRunnerMeta("last_tick_at", String(nowMs));
  }

  async reloadCron(jobId) {
    const state = getJobState(jobId);
    const job = this._findJob(jobId);
    if (!state || !job) return;
    this.parsed.set(jobId, parseCron(state.cron || job.defaultCron));
  }

  async runJob(jobId, trigger = "manual") {
    const job = this._findJob(jobId);
    if (!job) throw new Error(`unknown job: ${jobId}`);
    if (this.activeRuns.has(jobId)) throw new Error(`${jobId} already running`);
    this.activeRuns.add(jobId);
    const runId = crypto.randomUUID();
    const startedAt = Date.now();
    recordRunStart({ id: runId, jobId, trigger });
    this.events.emit("event", { type: "started", jobId, runId, trigger, title: job.title, startedAt });
    const logLines = [];
    const logEvent = (level, message, payload) => {
      logLines.push({ ts: Date.now(), level, message, payload });
      this.log(`[jobs:${jobId}] ${message}`);
    };
    const ctx = this._makeContext({ jobId, runId, logEvent });

    let status = "completed";
    let summary = null;
    let stats = null;
    let error = null;
    // B-28: every static handler gets a wallclock timeout. Pre-fix only
    // the dynamic agent handler had one; a hung MCP / Bedrock call kept
    // activeRuns set forever, blocking the next cron tick. Default 5 min;
    // a job can override via `runTimeoutMs` in its registry entry.
    const RUN_TIMEOUT_MS = Number.isFinite(job.runTimeoutMs)
      ? job.runTimeoutMs
      : 5 * 60 * 1000;
    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(Object.assign(
          new Error(`handler exceeded ${RUN_TIMEOUT_MS}ms wallclock`),
          { name: "JobTimeoutError" }
        ));
      }, RUN_TIMEOUT_MS);
    });
    try {
      // Activate any required on-demand MCPs up front so handlers don't have
      // to. We deactivate in finally — if the run crashed mid-way, we still
      // free the slot.
      for (const mcpName of job.mcps || []) {
        try {
          const r = await this.hub.activate(mcpName);
          if (!r.active) logEvent("warn", `MCP ${mcpName} did not activate: ${r.error}`);
          else logEvent("info", `activated MCP ${mcpName}`);
        } catch (e) {
          logEvent("warn", `activate ${mcpName} failed: ${e.message}`);
        }
      }
      const result = await Promise.race([job.handler(ctx), timeoutPromise]);
      summary = result?.summary || null;
      stats = result?.stats || null;
    } catch (err) {
      status = err.name === "JobTimeoutError" ? "timeout" : "failed";
      error = err.message;
      logEvent("error", `handler ${status}: ${err.message}`);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      // Keep-all-open policy (2026-05-29): MCPs stay running between jobs.
      // We no longer deactivate job.mcps here — hub.deactivate is a no-op
      // and tearing servers down was the old on-demand behaviour.
      const took = Date.now() - startedAt;
      logEvent("info", `finished status=${status} in ${took}ms`);
      // B-34: atomic finalize — single transaction for both updates so
      // a crash between them can't leave a completed run with no
      // last_run timestamp on job_state.
      recordRunFinishAtomic({ id: runId, jobId, status, summary, stats, log: logLines, error });
      this.activeRuns.delete(jobId);
      this.events.emit("event", {
        type: status === "completed" ? "completed" : "failed",
        jobId, runId, took, summary, stats, error, title: job.title,
      });
      // B-29: drain any pending immediate-re-run for this job. We've
      // already cleared activeRuns above, so the recursive runJob call
      // can proceed. Setimmediate to break the call stack.
      if (this.pendingImmediate.has(jobId)) {
        this.pendingImmediate.delete(jobId);
        setImmediate(() => {
          this.runJob(jobId, "queued").catch((e) =>
            this.log(`[jobs] ${jobId} queued re-run error: ${e.message}`));
        });
      }
    }
    return { runId, status, summary, stats };
  }

  _makeContext({ jobId, runId, logEvent }) {
    const hub = this.hub;
    const bedrockFactory = this.bedrockFactory;
    return {
      jobId,
      runId,
      hub,
      bedrockFactory,
      sessionsDir: this.sessionsDir,
      events: this.events,
      _systemPrompt: this.systemPrompt,
      log: logEvent,
      policy: getPolicy(),
      /**
       * Policy-gated tool call. Use this from handlers instead of hub.callTool
       * so every action goes through the auto-action gating + audit log.
       */
      async callTool(toolName, args, opts = {}) {
        const verdict = classifyToolCall({
          toolName,
          args,
          jobId,
          confidence: opts.confidence,
        });
        if (verdict.verdict === "blocked" || verdict.verdict === "draft_for_user" || verdict.verdict === "held_for_review") {
          recordAction({
            runId,
            jobId,
            kind: toolName,
            target: opts.target,
            verdict: verdict.verdict,
            summary: verdict.reason + (opts.summary ? ` — ${opts.summary}` : ""),
            payload: { args, ...verdict, opts },
          });
          logEvent("info", `policy ${verdict.verdict}: ${toolName} — ${verdict.reason}`);
          return { policy: verdict, content: [{ type: "text", text: `policy:${verdict.verdict} — ${verdict.reason}` }], isError: false };
        }
        // auto_committed → actually call
        try {
          const res = await hub.callTool(toolName, args);
          recordAction({
            runId,
            jobId,
            kind: toolName,
            target: opts.target,
            verdict: "auto_committed",
            summary: opts.summary || null,
            payload: { args, result: trimForLog(res) },
          });
          return res;
        } catch (err) {
          recordAction({
            runId,
            jobId,
            kind: toolName,
            target: opts.target,
            verdict: "errored",
            summary: err.message,
            payload: { args },
          });
          throw err;
        }
      },
    };
  }
}

function trimForLog(res) {
  try {
    const s = JSON.stringify(res);
    if (s.length <= 4096) return res;
    return { _trimmed: true, preview: s.slice(0, 2048) + "…" + s.slice(-512) };
  } catch {
    return { _unstringifiable: true };
  }
}
