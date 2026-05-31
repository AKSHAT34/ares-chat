#!/usr/bin/env node
// Ares Chat — local Titan-style chat frontend over the same MCP + steering +
// skills + RAG stack Kiro uses, driven by Bedrock Claude.
//
// Usage:
//   AWS_PROFILE=your-aws-profile node server.js
// Then open http://127.0.0.1:7777 in a browser.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import crypto from "node:crypto";
import multer from "multer";

import { McpHub } from "./lib/mcp-client.js";
import { openBugStore, listFindings, findingStats, setFindingStatus } from "./lib/debug-bot/store.js";
import { BedrockClaude } from "./lib/bedrock.js";
import { cacheStatus } from "./lib/llm/prompt-cache.js";
import { classify as classifyApproval, ApprovalRegistry } from "./lib/approval.js";
import { GatewayManager } from "./lib/gateway/run.js";
import { readConfig as readGatewayConfig, writeConfig as writeGatewayConfig } from "./lib/gateway/config.js";
import { sandboxStatus, setSandbox, getSandbox } from "./lib/sandbox/index.js";
import { rollup as skillsTelemetryRollup } from "./lib/skills/telemetry.js";
import { listCommands, getCommand, listPersonalities, setPersonality } from "./lib/commands/registry.js";
import { getPluginRegistry } from "./lib/plugins/loader.js";
import { transcribeBuffer, transcribeProbe } from "./lib/voice/transcribe.js";
import { runDoctor } from "./lib/doctor.js";
import { isAutoRecorderEligible as gateAutoRecord } from "./lib/auto-record-gate.js";
import { buildSystemPrompt, buildSystemPromptDetailed, getSystemPromptCaps } from "./lib/system-prompt.js";
import { buildDevSystemPrompt } from "./lib/dev-system-prompt.js";
import { recordDev, searchDev } from "./lib/dev-memory.js";
import { Agent } from "./lib/agent.js";
import { MODELS, getModel, autoRoute } from "./lib/models.js";
import { Orchestrator, getOrchestratorState, subscribeOrchestratorState } from "./lib/orchestrator.js";
import { processUpload, uploadsDirFor, ensureDir, makeFilename } from "./lib/uploads.js";
import { autoSummarize } from "./lib/memory-hooks.js";
import { indexTurn, searchSession, dropSession, reindexSession, countTurns, backfillAllSessions, searchAcrossSessions, listIndexedSessions, closeAllRagDbs } from "./lib/session-rag.js";
import { JobRunner } from "./lib/jobs/runner.js";
import { JOBS, getJob } from "./lib/jobs/registry.js";
import { listRuns, getRun, listActionsSince, getJobState, upsertJobState, listDynamicJobs, getDynamicJob, upsertDynamicJob, deleteDynamicJob } from "./lib/jobs/store.js";
import { parseCron as parseCronExpr } from "./lib/jobs/cron.js";
import { getPolicy, updatePolicy } from "./lib/jobs/policy.js";
import { authMiddleware, ensureToken, getTokenPath, logTokenForOperator } from "./lib/auth.js";
import { validateSession, repairSession, atomicWriteJson, startBackgroundValidator } from "./lib/session-integrity.js";
import { migrate, stampCurrent, CURRENT_SCHEMA } from "./lib/migrations.js";
import { runHygienePass } from "./lib/resource-hygiene.js";
import { requestIdMiddleware, metricsMiddleware, renderPromText, snapshotJson, incCounter } from "./lib/observability.js";
import { listArtifacts as listArtifactRecords, invalidate as invalidateArtifactIndex } from "./lib/artifact-index.js";
// Q-pass-5 P1-5 — SQLite write-through mirror. JSONL files remain source of truth.
// The mirror provides indexed cross-session search + a future read path.
import {
  openMirror as _openMirror,
  closeMirror as _closeMirror,
  markCleanShutdown as _markMirrorClean,
  flushAndStat as _mirrorFlushAndStat,
  upsertConversation as _mirrorUpsertConversation,
  deleteConversation as _mirrorDeleteConversation,
  upsertScheduledTask as _mirrorUpsertScheduledTask,
  deleteScheduledTask as _mirrorDeleteScheduledTask,
  upsertFeedItem as _mirrorUpsertFeedItem,
  upsertMemoryEntry as _mirrorUpsertMemoryEntry,
  upsertKgNode as _mirrorUpsertKgNode,
  upsertKgEdge as _mirrorUpsertKgEdge,
  _internals as _mirrorInternals,
} from "./lib/sqlite-mirror.js";
import { rebuildFromJsonl as _mirrorRebuild } from "./lib/sqlite-mirror-rebuild.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------- config --------
const PORT = parseInt(process.env.ARES_CHAT_PORT || "7777", 10);
const HOST = "127.0.0.1";
const WORKSPACE_ROOT = process.env.ARES_WORKSPACE || path.join(os.homedir(), "workspace");
const MCP_JSON = path.join(WORKSPACE_ROOT, ".kiro", "settings", "mcp.json");
const MODEL_ID = process.env.ARES_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514";
const SESSIONS_DIR = path.join(__dirname, "sessions");
fs.mkdirSync(SESSIONS_DIR, { recursive: true });
const STREAM_LOGS_DIR = path.join(SESSIONS_DIR, "stream-logs");
fs.mkdirSync(STREAM_LOGS_DIR, { recursive: true });
const CHECKPOINTS_DIR = path.join(SESSIONS_DIR, "checkpoints");
fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
const UPLOADS_ROOT = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

// E-4 / E-5: path-traversal defence. UUIDs sent by the client must match
// the canonical shape; anything containing `..`, `/`, urlencoded slashes,
// or other shenanigans is rejected before it reaches the filesystem.
// We accept v4 UUIDs (with or without dashes) and the literal string
// "unassigned" used as a multer fallback for browser uploads that
// haven't been associated with a session yet.
const _UUID_RE = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
function isValidSessionId(s) {
  return typeof s === "string" && _UUID_RE.test(s);
}
// Express middleware that enforces a UUID-shaped :id (or :sessionId).
// Reject everything else with 400 BEFORE any fs op.
function requireUuidParam(name = "id") {
  return (req, res, next) => {
    const v = req.params[name];
    if (!isValidSessionId(v)) {
      return res.status(400).json({ error: `invalid ${name}: must be a UUID` });
    }
    next();
  };
}

// Multer: store under uploads/<sessionId>/, use safe filenames.
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      // E-5: validate sessionId BEFORE building the destination path.
      // Pre-fix `req.body.sessionId` was attacker-controlled and joined
      // straight into UPLOADS_ROOT. A "../../tmp/x" landed files
      // outside the uploads root.
      const candidate = req.params.sessionId || req.body.sessionId || "unassigned";
      const sid = candidate === "unassigned" || isValidSessionId(candidate)
        ? candidate : "unassigned";
      const dir = path.join(UPLOADS_ROOT, sid);
      try {
        await ensureDir(dir);
        cb(null, dir);
      } catch (e) { cb(e); }
    },
    filename: (req, file, cb) => cb(null, makeFilename(file.originalname)),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

// -------- state --------
const hub = new McpHub({ mcpJsonPath: MCP_JSON, workspaceRoot: WORKSPACE_ROOT });
const REGION = process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-west-2";
const PROFILE = process.env.AWS_PROFILE;

// Factory: create a BedrockClaude instance for any model ID.
function bedrockFactory(modelId) {
  return new BedrockClaude({ modelId, region: REGION, profile: PROFILE });
}
// Default instance for backward compat (auto-title, health checks, etc.)
const bedrock = bedrockFactory(MODEL_ID);

let systemPrompt = "";
const sessions = new Map(); // sessionId -> { messages, createdAt }

// Track in-flight chat streams so the client can resume live progress after
// a page refresh. Key = sessionId, value = { startedAt, mode, model }.
const activeStreams = new Map();

// Phase U06 — registry for pending high/medium-confirm tool calls. Keyed
// by sessionId. The agent loop awaits a single pending entry per session
// at a time. Resolved by POST /api/runs/:id/approve|deny.
const approvalRegistry = new ApprovalRegistry();

/**
 * Build a per-session approval gate closure that the Agent loop calls
 * before each tool dispatch. Returns:
 *   { event?, deny?, reason?, resolved? }
 * where the caller yields `event` first (approval_required), then either
 * skips the tool with `deny=true` or yields `resolved` and proceeds.
 */
function makeApprovalGate(sessionId) {
  return async (toolUse) => {
    const classification = classifyApproval(toolUse?.name, toolUse?.input || {});
    if (!classification.requireConfirm) {
      // Low / medium / shell-non-destructive — proceed, no SSE event.
      return null;
    }
    // Cancel any prior pending in case a stale one leaked in. Reasonable
    // because agent loop only enqueues one at a time per session.
    if (approvalRegistry.has(sessionId)) {
      approvalRegistry.cancel(sessionId, "superseded by new request");
    }
    const { id, promise } = approvalRegistry.enqueue({
      sessionId,
      toolName: toolUse.name,
      input: toolUse.input,
      classification,
    });
    const event = {
      type: "approval_required",
      approvalId: id,
      toolUseId: toolUse.id,
      toolName: toolUse.name,
      input: toolUse.input,
      classification,
    };
    // Q-pass-4 (E) — also publish on the unified activity-stream bus so
    // the /api/activity/stream and /api/approvals/events SSE endpoints
    // see this event without scraping every chat stream.
    try {
      const { emitActivity } = await import("./lib/activity-stream.js");
      emitActivity({ source: "approvals", type: "approval_required", payload: { sessionId, ...event } });
    } catch {}
    const verdict = await promise;
    const resolved = {
      type: "approval_resolved",
      approvalId: id,
      toolUseId: toolUse.id,
      decision: verdict.decision,
      reason: verdict.reason || null,
    };
    try {
      const { emitActivity } = await import("./lib/activity-stream.js");
      emitActivity({ source: "approvals", type: "approval_resolved", payload: { sessionId, ...resolved } });
    } catch {}
    if (verdict.decision !== "approve") {
      return { event, deny: true, reason: verdict.reason, resolved };
    }
    return { event, resolved };
  };
}

// C-5: warmup timer handles, populated at boot, cleared on graceful shutdown.
const _warmupTimers = { boot: null, tick: null };

// C-2: background session-integrity validator handle.
let _integrityValidator = null;

// Explicit-stop registry: sessionId -> Set<AbortController> for every
// in-flight run on that session. B-15: a Map<sessionId, AbortController>
// lost the prior controller when a second tab on the same session sent
// a new message → Stop in tab 1 aborted tab 2's run; tab 1 kept running.
// Only the /stop endpoint aborts; plain socket close (refresh, tab close,
// network drop) does NOT abort — the run keeps going and the file-backed
// stream log lets the client resume via /stream-tail on reconnect.
const activeRuns = new Map();
function registerRun(sessionId, controller) {
  let set = activeRuns.get(sessionId);
  if (!set) { set = new Set(); activeRuns.set(sessionId, set); }
  set.add(controller);
}
function unregisterRun(sessionId, controller) {
  const set = activeRuns.get(sessionId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) activeRuns.delete(sessionId);
}
function abortRuns(sessionId) {
  const set = activeRuns.get(sessionId);
  if (!set || set.size === 0) return 0;
  let n = 0;
  for (const c of [...set]) {
    try { c.abort(); n++; } catch {}
  }
  return n;
}

// =====================================================================
// Stream logs (Wave B: file-backed resumable SSE)
//
// Every outgoing SSE event on /api/chat is appended as a JSON line to
// sessions/stream-logs/<sessionId>.jsonl. Clients that reconnect mid-stream
// can replay the whole log through /api/sessions/:id/stream-tail so they
// see byte-for-byte what the original stream would have delivered, instead
// of a snapshot of session.json every 5 iterations.
//
// Each log entry: { seq, ts, event }. seq is a monotonic counter starting
// at 1 per session stream; ts is Date.now() at write time; event is the
// SSE payload (same shape the original /api/chat emits).
//
// A live EventEmitter is also maintained per session so the tail endpoint
// can deliver newly-written events without polling the filesystem.
// =====================================================================
import { EventEmitter } from "node:events";

function streamLogPath(sessionId) {
  return path.join(STREAM_LOGS_DIR, `${sessionId}.jsonl`);
}

// sessionId -> { seq, emitter, startedAt }
const streamLogState = new Map();

function openStreamLog(sessionId) {
  // B-14: if a previous run for this session left state behind, signal
  // closed to its tail clients FIRST so their listeners detach. Otherwise
  // they orphan on the old emitter and hang until their own timeout.
  closeStreamLog(sessionId);
  const p = streamLogPath(sessionId);
  try { fs.unlinkSync(p); } catch {} // start fresh each new run
  // D-1: keep an open file descriptor per session and write with
  // fs.writeSync(fd, …). Pre-fix appendFileSync did open+write+close on
  // EVERY SSE event — three syscalls per text_delta (~30/sec during a
  // streaming turn). Now: one syscall per event. Seq contiguity is still
  // preserved because writes remain synchronous within appendStreamEvent.
  let fd = null;
  try { fd = fs.openSync(p, "a"); } catch (err) {
    console.error(`[stream-log] open failed for ${sessionId}: ${err.message}`);
  }
  const state = {
    seq: 0,
    emitter: new EventEmitter(),
    startedAt: Date.now(),
    path: p,
    fd,
  };
  state.emitter.setMaxListeners(50); // generous: multiple tabs can tail
  streamLogState.set(sessionId, state);
  return state;
}

function appendStreamEvent(sessionId, event) {
  const state = streamLogState.get(sessionId);
  if (!state) return;
  // Write FIRST, increment seq SECOND so seqs are strictly contiguous on
  // disk. (Pre-fix RP1 reversal note preserved here — every emitted seq
  // has a matching JSONL line.)
  const nextSeq = state.seq + 1;
  const entry = { seq: nextSeq, ts: Date.now(), event };
  const line = JSON.stringify(entry) + "\n";
  try {
    if (state.fd != null) {
      fs.writeSync(state.fd, line);
    } else {
      // Fallback: open failed at openStreamLog time (e.g. race with
      // unlink). One-shot append — slow but correct.
      fs.appendFileSync(state.path, line);
    }
    state.seq = nextSeq;
    state.emitter.emit("entry", entry);
  } catch (err) {
    // P2-2 — log-append failure shouldn't crash the stream, and we must
    // NOT advance seq (so we don't emit a seq with no matching disk line).
    // But silently retrying forever can mask a wedged disk and let the
    // live socket race ahead of a log the client can never replay. Count
    // consecutive failures and, past a threshold, mark the stream log
    // broken so /stream-tail stops promising a replay it can't deliver.
    state.appendFails = (state.appendFails || 0) + 1;
    console.error(`[stream-log] append failed for ${sessionId} (#${state.appendFails}): ${err.message}`);
    if (state.appendFails >= 5 && !state.broken) {
      state.broken = true;
      console.error(`[stream-log] ${sessionId} marked broken after ${state.appendFails} append failures — replay disabled for this run.`);
    }
    return;
  }
  // Reset the failure counter on any successful write.
  state.appendFails = 0;
}

function closeStreamLog(sessionId) {
  const state = streamLogState.get(sessionId);
  if (!state) return;
  state.emitter.emit("closed");
  // D-1: close the kept-open file descriptor.
  if (state.fd != null) {
    try { fs.closeSync(state.fd); } catch {}
    state.fd = null;
  }
  streamLogState.delete(sessionId);
  // Delete the log file — at this point everything is persisted in the
  // regular session.json so the log is redundant.
  try { fs.unlinkSync(streamLogPath(sessionId)); } catch {}
}

function readStreamLog(sessionId, fromSeq = 0) {
  const p = streamLogPath(sessionId);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    if (!raw) return [];
    const out = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry && entry.seq > fromSeq) out.push(entry);
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

// =====================================================================
// Checkpoints (Item 3 — long-run resume)
//
// Per-iteration snapshot of the live agent transcript so that a server
// crash (SIGKILL, credentials expiry, node exception) mid-long-run can
// be recovered. The checkpoint is written after EVERY iteration that
// advances `working` — smaller than a full session.json dump since we
// only serialise the agent's transcript, not the UI-side metadata.
//
// Checkpoint shape: { sessionId, iteration, mode, model, workingMessages, createdAt, updatedAt }
// Deleted on clean done/error/interrupted.
// =====================================================================

function checkpointPath(sessionId) {
  return path.join(CHECKPOINTS_DIR, `${sessionId}.json`);
}

function writeCheckpoint(sessionId, data) {
  try {
    // Phase 4 — atomic. Half-written checkpoints used to leave bare
    // braces on disk that crashed resume-run on the next boot.
    atomicWriteJson(checkpointPath(sessionId), {
      ...data,
      sessionId,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error(`[checkpoint] write failed for ${sessionId}: ${err.message}`);
  }
}

function readCheckpoint(sessionId) {
  const p = checkpointPath(sessionId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function deleteCheckpoint(sessionId) {
  try { fs.unlinkSync(checkpointPath(sessionId)); } catch {}
}

function loadSessionFromDisk(id) {
  const p = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
  // Phase 5 — schema migration FIRST. If raw is from an older schema, run
  // the migration pipeline up to CURRENT. If it's from a NEWER schema
  // (someone ran a future build then rolled back), refuse to load —
  // surfacing the file rather than silently corrupting it.
  try {
    const migrated = migrate(raw);
    if (migrated.applied.length) {
      console.log(`[migrate] ${id}: applied ${migrated.applied.join(" → ")}`);
      raw = migrated.session;
      // Persist the migration result so the next read is a no-op.
      try { atomicWriteJson(p, raw); } catch (e) {
        console.warn(`[migrate] could not persist migration for ${id}: ${e.message}`);
      }
    } else {
      raw = migrated.session;
    }
  } catch (e) {
    console.error(`[migrate] ${id} refused: ${e.message}`);
    return null;
  }
  // Phase 4 — repair on read. Old sessions on disk may have orphan
  // tool_results, missing tool_result stubs, or empty content blocks
  // (legacy crash-mid-write artefacts). Validate first so we only touch
  // what's broken; if repair changes the message count, write the
  // repaired version back to disk so the fix sticks.
  const v = validateSession(raw);
  if (!v.ok) {
    const before = (raw.messages || []).length;
    const repaired = repairSession(raw);
    const after = (repaired.messages || []).length;
    console.warn(
      `[integrity] ${id} had ${v.errors.length} violation(s) ` +
      `(${v.errors.slice(0, 3).map((e) => e.code).join(",")}` +
      `${v.errors.length > 3 ? `,+${v.errors.length - 3}` : ""}) — ` +
      `messages ${before}→${after}`
    );
    try { atomicWriteJson(p, repaired); } catch (e) {
      console.warn(`[integrity] could not persist repair for ${id}: ${e.message}`);
    }
    return repaired;
  }
  return raw;
}
function saveSessionToDisk(id, data) {
  // Phase 5 — always stamp the schema version on writes. New sessions
  // come from createNewSession() with schemaVersion already set, but
  // belt-and-braces: any code path saving a session must produce a
  // CURRENT-versioned record.
  const versioned = stampCurrent(data);
  // Phase 4 — atomic write + invariant check. We REPAIR on save (not
  // refuse) because the agent loop appends messages incrementally and
  // can briefly hold an unbalanced transcript between the tool_use
  // append and the matching tool_result append. Repairing makes the
  // on-disk copy correct at every moment a reader could observe it.
  const repaired = repairSession(versioned);
  const v = validateSession(repaired);
  if (!v.ok) {
    // Repair didn't make it valid — that's a logic bug we want to know
    // about, but we still persist so we don't lose the user's data.
    console.warn(
      `[integrity] save for ${id} still has ${v.errors.length} violation(s) after repair: ` +
      v.errors.slice(0, 3).map((e) => `${e.code}@${e.at || "?"}`).join("; ")
    );
  }
  atomicWriteJson(path.join(SESSIONS_DIR, `${id}.json`), repaired);
  // Q-pass-3 (work-stream C) — drop the artifact index cache for this
  // session so the next /api/artifacts call re-scans it. Cheap (Map.delete).
  try { invalidateArtifactIndex(id); } catch {}
  // Q-pass-5 P1-5 — write-through to SQLite mirror. Async (queue-flushed),
  // never blocks the JSONL write. Failures here log but don't propagate.
  try { _mirrorUpsertConversation(repaired); } catch (e) {
    console.warn(`[mirror] upsertConversation ${id} failed: ${e.message}`);
  }
}

function firstUserTextFromMessages(messages) {
  for (const m of messages || []) {
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      // Skip tool_result-only messages
      const textBlock = m.content.find((b) => b && b.type === "text");
      if (textBlock && typeof textBlock.text === "string") {
        // Strip our server-synthesized <file>/<attachment> wrappers. Handle
        // both well-formed and malformed cases (open tag with no close).
        let t = textBlock.text;
        t = t.replace(/<(file|attachment)[^>]*>[\s\S]*?<\/\1>/gi, "");
        t = t.replace(/<(file|attachment)[^>]*>[\s\S]*$/gi, "");
        t = t.trim();
        if (t) return t;
        // Message was only an attachment wrapper — synthesize something useful
        const m1 = textBlock.text.match(/<(file|attachment)[^>]*name="([^"]+)"/i);
        if (m1) return `File: ${m1[2]}`;
        return textBlock.text;
      }
    }
  }
  return "";
}

// Q-pass-4 (work-stream B / Phase 0c) — short greetings users type
// before asking the real question. We need to skip these so Recents
// doesn't show 20 sessions all titled "Hi".
//
// Detection rule (case-insensitive, ignoring leading/trailing whitespace
// and punctuation): cleaned text is ≤ 4 chars AND matches the regex.
const GREETING_RE = /^(hi+|hey+|yo+|sup+|hola+|ola+|oi+|ya+|heya+|hiya+|howdy+)$/i;
function _isGreetingMessage(text) {
  if (!text) return false;
  // Strip leading/trailing whitespace + punctuation, then collapse.
  const cleaned = String(text).trim().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "").trim();
  if (!cleaned) return false;
  if (cleaned.length > 4) return false;
  return GREETING_RE.test(cleaned);
}
function _firstUserTextFromMessage(m) {
  if (!m || m.role !== "user") return "";
  if (typeof m.content === "string") return _cleanTitleText(m.content);
  if (Array.isArray(m.content)) {
    // Skip tool_result-only carriers — they have no human-typed text.
    if (m.content.length && m.content.every((b) => b && b.type === "tool_result")) return "";
    const textBlock = m.content.find((b) => b && b.type === "text");
    if (textBlock && typeof textBlock.text === "string") {
      return _cleanTitleText(textBlock.text);
    }
  }
  return "";
}
// Strip synthetic wrappers the agent/compressor injects as user-role
// messages so they never leak into a session title. Covers
// <context_summary>/<contextsummary>, <relevant_history>, <memory_brief>,
// <knowledge_graph_context>, <file>/<attachment>, and any leading
// angle-bracket tag. Returns "" when nothing human-typed remains.
function _cleanTitleText(text) {
  let t = String(text || "");
  // Drop whole synthetic blocks (paired tags), tolerant of the
  // underscore-less variants the UI showed ("<contextsummary …>").
  t = t.replace(/<(context_?summary|relevant_history|memory_brief|knowledge_graph_context|file|attachment)[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Drop an unclosed leading synthetic block (truncated mid-tag).
  t = t.replace(/<(context_?summary|relevant_history|memory_brief|knowledge_graph_context|file|attachment)[^>]*>[\s\S]*$/gi, "");
  t = t.trim();
  // If what remains still STARTS with a synthetic-looking tag, it's not a
  // real user prompt — reject it so the caller falls through.
  if (/^<\s*(context|relevant|memory|knowledge|file|attachment|system)/i.test(t)) return "";
  return t;
}
/** Pick the first user message that isn't a short greeting. Returns "" if none. */
function _firstSubstantiveUserText(messages) {
  for (const m of messages || []) {
    if (m.role !== "user") continue;
    const t = _firstUserTextFromMessage(m);
    if (!t) continue;
    if (_isGreetingMessage(t)) continue;
    return t;
  }
  return "";
}

function deriveTitle(session) {
  // Explicit user-set title wins — UNLESS it's a leaked synthetic wrapper
  // (older sessions auto-saved a <context_summary>/<contextsummary> blob
  // as the title before this was fixed). Reject those and re-derive.
  if (session.title && session.title.trim()) {
    const explicit = session.title.trim();
    if (!/^<\s*(context|relevant|memory|knowledge|file|attachment|system)/i.test(explicit)) {
      return explicit;
    }
    // else: fall through to re-derive from messages.
  }
  const messages = session.messages || [];
  // Q-pass-4 (Phase 0c) — try the first substantive user message;
  // skip leading greetings like "hi" / "hey" so Recents shows the
  // real prompt instead of "Hi" for every session.
  let raw = _firstSubstantiveUserText(messages);
  if (!raw) {
    // Fall back to legacy behaviour (first non-empty user text). If
    // even that is a greeting-only session, fall through to a stable
    // "New chat" label optionally stamped with createdAt.
    raw = firstUserTextFromMessages(messages);
    if (!raw || _isGreetingMessage(raw)) {
      const ts = session.createdAt || session.updatedAt;
      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const mi = String(d.getMinutes()).padStart(2, "0");
          return `New chat ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
        }
      }
      return "New chat";
    }
  }
  // Strip markdown + truncate. Also drop any residual leading tag.
  const clean = raw.replace(/[`*_#>]/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, 70);
}

// Q-pass-4 (Phase 0c) — exported for the retitle backfill script and
// the q-derive-title.test.js gate. Not part of any public API contract.
deriveTitle.GREETING_RE = GREETING_RE;
deriveTitle._isGreetingMessage = _isGreetingMessage;
deriveTitle._firstSubstantiveUserText = _firstSubstantiveUserText;
deriveTitle._firstUserTextFromMessage = _firstUserTextFromMessage;

// D-2: per-file mtime-keyed projection cache. Pre-fix listSessionsFromDisk
// did sync readdir + readFile + JSON.parse over EVERY session file on
// every poll (browser sidebar = 4 s; with 200 sessions × 3 tabs that's
// 50 sync JSON.parses/sec blocking the event loop). Now: cache the
// projection per file, only re-parse when mtime changes.
//
// Map<id, { mtimeMs, projection }>. Stale entries (file deleted) are
// dropped on the next listing sweep.
const _sessionListCache = new Map();
function _projectSession(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!data.messages || data.messages.length === 0) return null;
    const id = path.basename(filePath, ".json");
    return {
      id,
      title: deriveTitle(data),
      hasCustomTitle: !!(data.title && data.title.trim()),
      pinned: !!data.pinned,
      messageCount: data.messages.length,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Q-pass-5 P1-1 — surface branched-from metadata so the dock
      // can render a tree indent.
      branchedFrom: data.branchedFrom || null,
      // Dev-mode tag so the UI can filter/badge dev sessions.
      _mode: data._mode || null,
    };
  } catch {
    return null;
  }
}
function listSessionsFromDisk() {
  const seenIds = new Set();
  const projections = [];
  for (const f of fs.readdirSync(SESSIONS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const id = f.replace(/\.json$/, "");
    seenIds.add(id);
    const p = path.join(SESSIONS_DIR, f);
    let mtimeMs;
    try { mtimeMs = fs.statSync(p).mtimeMs; } catch { continue; }
    const cached = _sessionListCache.get(id);
    if (cached && cached.mtimeMs === mtimeMs) {
      if (cached.projection) projections.push(cached.projection);
      continue;
    }
    const projection = _projectSession(p);
    _sessionListCache.set(id, { mtimeMs, projection });
    if (projection) projections.push(projection);
  }
  // Drop cache entries for files that disappeared since last listing.
  for (const id of [..._sessionListCache.keys()]) {
    if (!seenIds.has(id)) _sessionListCache.delete(id);
  }
  return projections.sort((a, b) => {
    // Pinned first, then by updatedAt desc
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

// Remove session JSONs that contain zero messages. Called on boot to clean
// up empties created by page refreshes. NEVER deletes sessions with any content.
function pruneEmptySessions() {
  let removed = 0;
  for (const f of fs.readdirSync(SESSIONS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(SESSIONS_DIR, f);
    try {
      const raw = fs.readFileSync(p, "utf8");
      if (!raw || raw.trim().length < 10) {
        // Corrupted/empty file — delete
        fs.unlinkSync(p);
        removed++;
        continue;
      }
      const data = JSON.parse(raw);
      // ONLY delete if messages array exists AND is empty AND file is < 500 bytes
      // (safety: never delete anything that might have real content)
      if (Array.isArray(data.messages) && data.messages.length === 0 && raw.length < 500) {
        fs.unlinkSync(p);
        removed++;
      }
    } catch {
      // Parse error — DON'T delete, might be recoverable
    }
  }
  if (removed) console.log(`[sessions] pruned ${removed} empty session(s)`);
}

// -------- app --------
const app = express();
app.use(express.json({ limit: "10mb" }));

// Phase 9 — request id stamp + metrics observation. Run BEFORE the
// access-log so the access line can include the id and so latency
// counted by the histogram matches what we log.
app.use(requestIdMiddleware);
app.use(metricsMiddleware);

// Phase 8 — per-request log line. One line per /api/* request: METHOD,
// path, status, ms, content-length, request id. Static asset requests
// are skipped to keep the log readable. We read req.path BEFORE
// handlers run so we log even if a handler throws and the response is
// rewritten.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const t0 = Date.now();
  const reqPath = req.path;
  const method = req.method;
  const reqId = req.reqId;
  res.on("finish", () => {
    const ms = Date.now() - t0;
    const cl = res.getHeader("content-length") ?? "-";
    // Tag long requests so they stand out at a glance.
    const slow = ms > 5000 ? " SLOW" : "";
    console.log(`[req=${reqId}] ${method} ${reqPath} → ${res.statusCode} ${ms}ms ${cl}b${slow}`);
  });
  next();
});
// Force browsers to always fetch the latest HTML/JS/CSS — the chat UI is
// local-only so caching only causes pain when we iterate.
app.use((req, res, next) => {
  if (/\.(html|js|css)$/.test(req.path) || req.path === "/") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Special-case index.html: inject a per-boot build token so app.js is
// fetched with a fresh URL every time the server restarts. Also injects
// the bearer token (read from ~/.kiro/runtime/ares.token at boot) so the
// page can attach Authorization headers to all /api/* fetches.
const BUILD_TOKEN = Date.now().toString(36);

// Host check shared with /api/* — blocks DNS-rebinding attacks that could
// otherwise read the embedded auth token out of index.html / jobs.html.
const PAGE_ALLOWED_HOSTS = new Set(["localhost:7777", "127.0.0.1:7777", "[::1]:7777"]);
function pageHostOk(req) {
  return PAGE_ALLOWED_HOSTS.has((req.headers.host || "").toLowerCase());
}

// E-6: escape attribute values for the synthetic <file>/<attachment>
// wrappers we wrap user-supplied filenames in before sending to Bedrock.
// A filename containing `">` followed by malicious text could close the
// tag and inject content the model treats as system-adjacent. Strip
// every quote and angle bracket — the wrappers are display-only sigils,
// not real markup, so plain ASCII-safe substitution is the correct fix.
function _escapeFileAttr(s) {
  return String(s ?? "").replace(/["'<>\r\n]/g, "_");
}

// D-7: cache the page templates at boot. Pre-fix every / and /jobs.html
// hit did a sync readFileSync. The files don't change at runtime —
// re-read only on syntax-check restart, which means a server restart.
let _indexHtmlRaw = null;
let _jobsHtmlRaw = null;
function _loadPageTemplate(name) {
  // Q-cutover: legacy templates live in public/legacy/ now. Read from
  // there. Q UI uses the public/q/ static mount.
  return fs.readFileSync(path.join(__dirname, "public", "legacy", name), "utf8");
}
function _getIndexHtml() {
  if (_indexHtmlRaw == null) _indexHtmlRaw = _loadPageTemplate("index.html");
  return _indexHtmlRaw;
}
function _getJobsHtml() {
  if (_jobsHtmlRaw == null) _jobsHtmlRaw = _loadPageTemplate("jobs.html");
  return _jobsHtmlRaw;
}

// Q-cutover: `/` redirects to the new Q UI. Legacy is reachable at
// `/legacy/` for emergency rollback. The redirect is page-host gated
// (DNS-rebinding pages can't trigger a 302 either).
app.get(["/", "/index.html"], (req, res) => {
  if (!pageHostOk(req)) { res.status(403).send("host not allowed"); return; }
  res.redirect(302, "/q/");
});

// Legacy /jobs.html redirects to /q/#/jobs (the Q jobs route).
app.get("/jobs.html", (req, res) => {
  if (!pageHostOk(req)) { res.status(403).send("host not allowed"); return; }
  res.redirect(302, "/q/#/jobs");
});

// Q-cutover — legacy emergency-rollback surface. Same templating the
// old / route used, mounted at /legacy/. Tray's "Open full window
// (legacy)" entry points here. Token is inlined exactly as before.
app.get("/legacy/", (req, res) => {
  if (!pageHostOk(req)) { res.status(403).send("host not allowed"); return; }
  try {
    const raw = _getIndexHtml();
    const token = ensureToken();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      raw
        .replace(/__BUILD__/g, BUILD_TOKEN)
        .replace(/__ARES_TOKEN__/g, token)
    );
  } catch (err) { res.status(500).send(err.message); }
});
app.get("/legacy/index.html", (req, res) => res.redirect(302, "/legacy/"));
app.get("/legacy/jobs.html", (req, res) => {
  if (!pageHostOk(req)) { res.status(403).send("host not allowed"); return; }
  try {
    const raw = _getJobsHtml();
    const token = ensureToken();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(raw.replace(/__ARES_TOKEN__/g, token));
  } catch (err) { res.status(500).send(err.message); }
});
// Legacy assets: old app.js + any other static files under public/legacy/.
app.use("/legacy", staticHostGate, express.static(path.join(__dirname, "public", "legacy"), {
  setHeaders: (res, p) => {
    if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
  },
}));

// Top-level static (lib/anim.css etc.) — keep mounted at /lib (Q UI
// pulls these directly). Other public assets stay at /<name>.
app.use(express.static(path.join(__dirname, "public")));
// E-2 / E-3: page-host check on the static handlers. Pre-fix /uploads
// and /docs were mounted BEFORE authMiddleware, so a DNS-rebound page
// could read every uploaded file (emails, screenshots, vendor data) or
// fingerprint the install via /docs. Tokens aren't viable for /uploads
// because <img src="/uploads/...">  doesn't carry an Authorization
// header — but the Host check defends against the rebinding scenario,
// which is the primary threat model.
function staticHostGate(req, res, next) {
  if (!pageHostOk(req)) { res.status(403).send("host not allowed"); return; }
  next();
}

// Phase U20 — serve the docs/ folder so the tray "Docs" item and any
// in-app links can render plain markdown files. No external hosting,
// no Docusaurus — just static .md served as text/plain so the user's
// browser/editor renders them inline.
app.use("/docs", staticHostGate, express.static(path.join(__dirname, "docs"), {
  setHeaders: (res, p) => {
    if (p.endsWith(".md")) res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  },
}));

// Phase Q1 — Q UI bundle. Built by ares-ui (Vite) into public/q/. Served
// pre-auth (the bundle has no secrets) but page-host gated so a DNS-
// rebinding page can't pull the JS for fingerprinting. The bearer token
// is fetched at runtime via /api/* (which IS auth-gated). Existing
// browser UI at / keeps working unchanged until Q22 cuts over.
const Q_DIR = path.join(__dirname, "public", "q");
if (fs.existsSync(Q_DIR)) {
  app.use("/q", staticHostGate, express.static(Q_DIR, {
    // SPA fallback: any route under /q/* that isn't a real asset
    // returns the bundled index.html so the Lit router can take over.
    setHeaders: (res, p) => {
      if (p.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      } else {
        // Vite emits content-hashed asset filenames, safe to cache hard.
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  // SPA history fallback for /q/<route>.
  app.get(/^\/q\/(?!assets\/).*/, staticHostGate, (req, res) => {
    const indexPath = path.join(Q_DIR, "index.html");
    if (!fs.existsSync(indexPath)) return res.status(404).end();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(indexPath);
  });
}
// Serve uploaded files back so the UI can preview images etc.
app.use("/uploads", staticHostGate, express.static(UPLOADS_ROOT));

// Phase 3 — Token + Host-header auth on /api/* (except /api/health).
// Mounted BEFORE any /api/* route so unauthenticated traffic never reaches
// session/job/chat handlers. See lib/auth.js for the threat model.
app.use(authMiddleware);

// Phase 7a — animation slow-mo debug toggle. The cookie is read by
// /lib/anim.js at every page load; setting it 4×s every CSS transition
// duration via :root[data-anim-slow="1"] in /lib/anim.css. Useful for
// frame-drop hunts during the polish pass. Localhost-only via the
// auth/host check that already gates /api/*.
// Phase Q3 — auth handshake for the Q UI bundle. Page-host gated AND
// guarded by the same allowlist the legacy / page uses (pageHostOk).
// Returns the bearer token only if the Host header is one of our
// loopback variants. DNS-rebinding pages get 403.
//
// Defence-in-depth: the lib/auth.js Host check (E-1) ALSO fires before
// the PUBLIC_PATHS exemption — we still call pageHostOk here to keep
// the surface explicit (and because the auth middleware permits
// localhost:7777 as a bare host but the page allowlist is the same set,
// so behaviour is identical).
app.get("/api/auth-handshake", (req, res) => {
  if (!pageHostOk(req)) {
    return res.status(403).json({ error: "host not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ token: ensureToken() });
});

// Phase Q13 — knowledge graph read API. The cold build is offline (a
// future migration script populates ~/.ares/knowledge-graph.jsonl).
// The Q UI gracefully renders "Browse all" when this is empty.
import * as _kg from "./lib/knowledge-graph.js";
app.get("/api/knowledge-graph/stats", (req, res) => {
  try { res.json(_kg.getStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/knowledge-graph/:type/list", (req, res) => {
  try { res.json({ nodes: _kg.listNodes({ type: req.params.type }) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Q-pass-5 close-out — bulk edge listing for the graph visualisation.
app.get("/api/knowledge-graph/edges", (req, res) => {
  try { res.json({ edges: _kg.listEdges() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/knowledge-graph/node/:id", (req, res) => {
  try {
    const { node, edges } = _kg.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: "not found" });
    res.json({ node, edges });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/knowledge-graph/rebuild", (req, res) => {
  try { res.json(_kg.rebuildEmpty()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Item 1: Server-side refresh endpoint ────────────────────────────
// Triggers immediate re-extraction from memory journal, Outlook inbox,
// Slack unreads, and calendar (next 7 days).
app.post("/api/knowledge-graph/refresh", express.json(), async (req, res) => {
  try {
    const haiku = bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0");
    let totalAdded = 0;

    // (a) Memory journal — last 50 entries
    try {
      const journalPath = path.join(os.homedir(), ".kiro", "memory", "journal.jsonl");
      if (fs.existsSync(journalPath)) {
        const raw = fs.readFileSync(journalPath, "utf8");
        const lines = raw.split("\n").filter(Boolean);
        const last50 = lines.slice(-50);
        const text = last50.map((l) => { try { const j = JSON.parse(l); return j.summary || j.details || ""; } catch { return ""; } }).join("\n");
        if (text.length > 100) {
          const ext = await _kgBuilder.extractEntities({ haiku, text, hint: "Memory journal entries" });
          const c = _kgBuilder.ingestExtracted(ext);
          totalAdded += c.nodesAdded + c.edgesAdded;
        }
      }
    } catch {}

    // (b) Outlook inbox (if email-mcp is running)
    try {
      const r = await hub.activate("email-mcp");
      if (r.active) {
        hub.pinMcp("email-mcp");
        try {
          const inbox = await hub.callTool("email-mcp__email_inbox", { limit: 50 });
          const text = (inbox?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("\n");
          if (text.length > 100) {
            const ext = await _kgBuilder.extractEntities({ haiku, text, hint: "Outlook inbox" });
            const c = _kgBuilder.ingestExtracted(ext);
            totalAdded += c.nodesAdded + c.edgesAdded;
          }
        } finally { try { hub.unpinMcp("email-mcp"); } catch {} }
      }
    } catch {}

    // (c) Slack unreads (if chat-mcp is running)
    try {
      const r = await hub.activate("chat-mcp");
      if (r.active) {
        hub.pinMcp("chat-mcp");
        try {
          const slack = await hub.callTool("chat-mcp__get_unreads", { channels: [] });
          const text = (slack?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("\n");
          if (text.length > 100) {
            const ext = await _kgBuilder.extractEntities({ haiku, text, hint: "Slack unreads" });
            const c = _kgBuilder.ingestExtracted(ext);
            totalAdded += c.nodesAdded + c.edgesAdded;
          }
        } finally { try { hub.unpinMcp("chat-mcp"); } catch {} }
      }
    } catch {}

    // (d) Calendar — next 7 days (if email-mcp is running)
    try {
      const r = await hub.activate("email-mcp");
      if (r.active) {
        hub.pinMcp("email-mcp");
        try {
          const now = new Date();
          const startDate = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${now.getFullYear()}`;
          const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const endDate = `${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}-${end.getFullYear()}`;
          const cal = await hub.callTool("email-mcp__calendar_view", { start_date: startDate, end_date: endDate, view: "week" });
          const text = (cal?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("\n");
          if (text.length > 50) {
            const ext = await _kgBuilder.extractEntities({ haiku, text, hint: "Calendar events next 7 days — extract meetings/QBRs as type 'event' with date in meta, link attendees as person nodes" });
            const c = _kgBuilder.ingestExtracted(ext);
            totalAdded += c.nodesAdded + c.edgesAdded;
          }
        } finally { try { hub.unpinMcp("email-mcp"); } catch {} }
      }
    } catch {}

    const stats = _kg.getStats();
    res.json({ added: totalAdded, total: stats.nodes + stats.edges });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Item 2: Merge endpoint ──────────────────────────────────────────
app.post("/api/knowledge-graph/merge", express.json(), (req, res) => {
  try {
    const { sourceId, targetId } = req.body || {};
    if (!sourceId || !targetId) return res.status(400).json({ error: "sourceId + targetId required" });
    if (sourceId === targetId) return res.status(400).json({ error: "cannot merge a node with itself" });
    const result = _kgBuilder.mergeNodes(sourceId, targetId);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Item 5: Manual node/edge CRUD ───────────────────────────────────
app.post("/api/knowledge-graph/nodes", express.json(), (req, res) => {
  try {
    const { type, label, meta } = req.body || {};
    if (!type || !label) return res.status(400).json({ error: "type + label required" });
    const id = _kgBuilder.idFor(type, label);
    const added = _kgBuilder.appendNode({ id, type, label, meta: meta ?? null });
    if (!added) return res.status(409).json({ error: "node already exists or fuzzy-matched", id });
    res.json({ ok: true, id, type, label });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/knowledge-graph/nodes/:id", express.json(), (req, res) => {
  try {
    const { label, meta } = req.body || {};
    if (label === undefined && meta === undefined) return res.status(400).json({ error: "nothing to update" });
    const result = _kgBuilder.updateNode(req.params.id, { label, meta });
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/knowledge-graph/nodes/:id", (req, res) => {
  try {
    const result = _kgBuilder.deleteNode(req.params.id);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/knowledge-graph/edges", express.json(), (req, res) => {
  try {
    const { from, to, label, confidence } = req.body || {};
    if (!from || !to) return res.status(400).json({ error: "from + to required" });
    const added = _kgBuilder.appendEdge({ from, to, label: label || "related", confidence });
    if (!added) return res.status(409).json({ error: "edge already exists" });
    res.json({ ok: true, from, to, label: label || "related" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/knowledge-graph/edges/:from/:to/:label", (req, res) => {
  try {
    const result = _kgBuilder.deleteEdge(req.params.from, req.params.to, req.params.label);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Q-pass-5 P1-2 — Explain a graph edge in plain text.
//
// Body: { sourceId, targetId, relation }
// Returns: { explanation: "<one paragraph>", citedEntries: [...] }
//
// Uses Haiku over the cross-session memory journal. Cached 24h on disk
// at ~/.ares/cache/edge-explanations.jsonl so re-clicks are free.
const _edgeCacheFile = path.join(os.homedir(), ".ares", "cache", "edge-explanations.jsonl");
const _edgeCacheMem = new Map(); // key → {explanation, ts}
function _edgeCacheKey(s, t, r) { return `${s}|${r || "rel"}|${t}`; }
function _loadEdgeCache() {
  if (_edgeCacheMem.size > 0) return;
  try {
    const raw = fs.readFileSync(_edgeCacheFile, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j.key && j.explanation) _edgeCacheMem.set(j.key, j);
      } catch {}
    }
  } catch {}
}
function _saveEdgeCache(entry) {
  try {
    fs.mkdirSync(path.dirname(_edgeCacheFile), { recursive: true });
    fs.appendFileSync(_edgeCacheFile, JSON.stringify(entry) + "\n");
  } catch {}
}
const EDGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

app.post("/api/knowledge-graph/explain-edge", express.json(), async (req, res) => {
  const { sourceId, targetId, relation } = req.body || {};
  if (!sourceId || !targetId) {
    return res.status(400).json({ error: "sourceId + targetId required" });
  }
  _loadEdgeCache();
  const key = _edgeCacheKey(sourceId, targetId, relation);
  const hit = _edgeCacheMem.get(key);
  if (hit && (Date.now() - (hit.ts || 0)) < EDGE_CACHE_TTL_MS) {
    return res.json({ ok: true, cached: true, ...hit });
  }
  try {
    // Look up the labels.
    const sNode = _kg.getNode(sourceId).node;
    const tNode = _kg.getNode(targetId).node;
    const sLabel = sNode?.label || sourceId;
    const tLabel = tNode?.label || targetId;
    const rel = (relation || "related").toString().slice(0, 60);
    const haiku = bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0");
    const sys = `You explain WHY two entities in a knowledge graph are connected. Write ONE paragraph (2-4 sentences) in plain text. Be specific — name the project, vendor, or workflow that ties them. Do NOT invent specifics that aren't supported. Reply with the paragraph only, no preamble.`;
    const user = `Source: ${sLabel} (${sNode?.type || "unknown"})\nTarget: ${tLabel} (${tNode?.type || "unknown"})\nRelation: ${rel}\n\nWhy are these connected?`;
    const r = await haiku.invoke({
      system: sys,
      messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      max_tokens: 280,
    });
    const explanation = (r?.content || []).map((b) => b.text || "").join("").trim() || "(no explanation)";
    const entry = { key, sourceId, targetId, relation: rel, sourceLabel: sLabel, targetLabel: tLabel, explanation, ts: Date.now() };
    _edgeCacheMem.set(key, entry);
    _saveEdgeCache(entry);
    res.json({ ok: true, cached: false, ...entry });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Q-pass-3 — search the graph by label substring (powers the search popover
// above the canvas). Case-insensitive, prefix-first, capped at 12.
app.get("/api/knowledge-graph/search", (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ nodes: [] });
    const limit = Math.min(50, parseInt(String(req.query.limit || "12"), 10) || 12);
    res.json({ nodes: _kg.searchNodes(q, { limit }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Q-pass-3 — patch a node's meta blob. Used by the entity drawer to cache
// generated summaries (`{ summary: "…" }`) so we don't re-spend Haiku tokens
// the second time the user opens the same entity.
app.post("/api/knowledge-graph/entity/:id/meta", express.json(), (req, res) => {
  try {
    const { node } = _kg.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: "not found" });
    const patch = (req.body && typeof req.body === "object") ? req.body : null;
    if (!patch) return res.status(400).json({ error: "missing patch object" });
    const r = _kg.setNodeMeta(req.params.id, patch);
    if (!r.ok) return res.status(500).json({ error: r.error || "update failed" });
    res.json({ node: r.node });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Q-pass-3 — Haiku-generated summary for a single graph entity. Combines
// node + first-degree neighbours + any memory-journal entries that mention
// the label. Result is cached on `meta.summary` so repeat opens are free.
//
// Cache strategy: `?refresh=1` forces a re-generation.
import * as _kgBuilder from "./lib/knowledge-graph-builder.js";
app.post("/api/knowledge-graph/entity/:id/summarize", express.json(), async (req, res) => {
  try {
    const { node, edges } = _kg.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: "not found" });
    const refresh = String(req.query.refresh || "") === "1";
    if (!refresh && node.meta?.summary) {
      return res.json({ summary: node.meta.summary, cached: true, node });
    }

    // First-degree neighbour labels (direction + label) — we only need a
    // light digest for the prompt.
    const neigh = _kgBuilder.neighboursOf(node.id, { limit: 24 });
    const neighIds = new Set();
    for (const n of neigh) {
      if (n.from) neighIds.add(n.from);
      if (n.to) neighIds.add(n.to);
    }
    const neighLabels = new Map();
    if (neighIds.size > 0) {
      for (const cand of _kg.listNodes()) {
        if (neighIds.has(cand.id)) neighLabels.set(cand.id, cand.label || cand.id);
      }
    }
    const neighSummary = neigh.slice(0, 18).map((n) => {
      if (n.direction === "out") {
        return `${node.label} → ${neighLabels.get(n.to) || n.to} (${n.label})`;
      }
      return `${neighLabels.get(n.from) || n.from} → ${node.label} (${n.label})`;
    }).join("\n");

    // Memory entries that mention the label (cheap substring scan).
    const memoryHits = [];
    try {
      const journalPath = path.join(os.homedir(), ".kiro", "memory", "journal.jsonl");
      if (fs.existsSync(journalPath)) {
        const raw = fs.readFileSync(journalPath, "utf8");
        const needle = String(node.label || "").toLowerCase();
        if (needle.length >= 3) {
          for (const line of raw.split("\n")) {
            if (!line) continue;
            if (line.toLowerCase().includes(needle)) {
              try {
                const j = JSON.parse(line);
                memoryHits.push(`- ${j.timestamp || ""}: ${j.summary || ""}`);
              } catch {}
              if (memoryHits.length >= 8) break;
            }
          }
        }
      }
    } catch {}

    const prompt = [
      `Entity: ${node.label || node.id}`,
      `Type: ${node.type}`,
      node.meta ? `Metadata: ${JSON.stringify(node.meta)}` : "",
      "",
      "First-degree relationships:",
      neighSummary || "(none)",
      "",
      "Memory journal mentions:",
      memoryHits.length ? memoryHits.join("\n") : "(none)",
      "",
      "Write a single concise paragraph (<= 120 words) summarizing what the user knows about this entity. Mention notable relationships and any pattern visible in the journal. Use the entity's label naturally; do NOT enumerate every relationship.",
    ].filter(Boolean).join("\n");

    const haiku = bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0");
    const r = await haiku.invoke({
      system: "You summarize entities from a personal knowledge graph for a single user. Be specific, grounded, and brief.",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      max_tokens: 320,
    });
    const summary = (r?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("").trim();
    if (!summary) return res.status(500).json({ error: "empty summary" });
    try { _kg.setNodeMeta(node.id, { summary, summary_ts: Date.now() }); } catch {}
    res.json({ summary, cached: false, node, edges: edges.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Q-pass-3 — Memory inspector routes. The memory store lives at the user
// level (~/.kiro/memory/journal.jsonl + vectors.db), driven by the kiro-memory
// MCP server. The inspector reads from the journal directly so the UI doesn't
// have to spin up the MCP just to browse history. Semantic search delegates
// to the MCP via the hub — keeps the embedder code in one place.
const MEMORY_JOURNAL = path.join(os.homedir(), ".kiro", "memory", "journal.jsonl");

function _readJournalEntries() {
  if (!fs.existsSync(MEMORY_JOURNAL)) return [];
  const out = [];
  const raw = fs.readFileSync(MEMORY_JOURNAL, "utf8");
  let id = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      // files_touched + tags arrive as JSON-encoded strings; flatten back to arrays.
      let tags = [];
      try { tags = typeof j.tags === "string" ? JSON.parse(j.tags) : (Array.isArray(j.tags) ? j.tags : []); } catch {}
      let files = [];
      try { files = typeof j.files_touched === "string" ? JSON.parse(j.files_touched) : (Array.isArray(j.files_touched) ? j.files_touched : []); } catch {}
      // Confidence is implicit — we don't track usage telemetry yet, so each
      // entry is treated as "user-confirmed" (1.0). When telemetry lands the
      // gate becomes a real number. DO NOT invent fake counts.
      const hasDetails = (j.details && j.details.length > 16) || (j.lessons && j.lessons.length > 0);
      const confidence = hasDetails ? 1.0 : 0.85;
      const category = j.outcome || (tags[0] || "general");
      const inferred = j.kind === "inferred" || /(^|\s)inferred(\s|$)/i.test(j.kind || "");
      out.push({
        id: ++id,
        ts: j.timestamp ? Date.parse(j.timestamp) : 0,
        timestamp: j.timestamp || null,
        kind: j.kind || "task",
        category,
        summary: j.summary || "",
        details: j.details || "",
        lessons: j.lessons || "",
        outcome: j.outcome || "",
        tags,
        files_touched: files,
        confidence,
        usedCount: 0,
        confirmedCount: 0,
        rejectedCount: 0,
        inferred,
      });
    } catch {}
  }
  return out;
}

function _filterMemory(entries, q) {
  const tokens = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return entries;
  return entries.filter((it) => {
    const hay = `${it.summary} ${it.details} ${it.lessons} ${it.outcome} ${(it.tags || []).join(" ")} ${it.kind} ${it.category}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}

function _sortMemory(entries, sort) {
  const arr = [...entries];
  switch (sort) {
    case "most-used":
      arr.sort((a, b) => (b.usedCount - a.usedCount) || (b.ts - a.ts));
      break;
    case "highest-confidence":
      arr.sort((a, b) => (b.confidence - a.confidence) || (b.ts - a.ts));
      break;
    case "recent":
    default:
      arr.sort((a, b) => b.ts - a.ts);
      break;
  }
  return arr;
}

app.get("/api/memory/list", (req, res) => {
  try {
    const all = _readJournalEntries();
    const types = new Set(); const cats = new Set();
    for (const it of all) {
      if (it.kind) types.add(it.kind);
      if (it.category) cats.add(it.category);
    }
    const stats = {
      total: all.length,
      proc: all.filter((it) => /procedure|skill/i.test(it.kind)).length,
      facts: all.filter((it) => /fact|preference/i.test(it.kind)).length,
      inferred: all.filter((it) => it.inferred).length,
      compacted: 0,
    };
    const type = String(req.query.type || "all");
    const category = String(req.query.category || "all");
    const sort = String(req.query.sort || "recent");
    const includeInferred = String(req.query.includeInferred || "1") === "1";
    const q = String(req.query.q || "");
    const limit = Math.min(500, parseInt(String(req.query.limit || "200"), 10) || 200);

    let items = all;
    if (!includeInferred) items = items.filter((it) => !it.inferred);
    if (type !== "all") items = items.filter((it) => it.kind === type);
    if (category !== "all") items = items.filter((it) => it.category === category);
    items = _filterMemory(items, q);
    const filteredCount = items.length;
    items = _sortMemory(items, sort).slice(0, limit);

    res.json({
      items,
      total: all.length,
      filtered: filteredCount,
      stats,
      types: [...types].sort(),
      categories: [...cats].sort(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a memory entry by its line index (id field from the list).
// Removes the line from the journal JSONL and returns { ok: true }.
app.delete("/api/memory/:id", (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!Number.isFinite(targetId) || targetId < 0) {
      return res.status(400).json({ error: "invalid id" });
    }
    const journalPath = path.join(os.homedir(), ".kiro", "memory", "journal.jsonl");
    if (!fs.existsSync(journalPath)) return res.status(404).json({ error: "journal not found" });
    const lines = fs.readFileSync(journalPath, "utf8").split("\n");
    // The id corresponds to the 1-indexed line number in the journal
    // (matching what /api/memory/list returns as `id`).
    const lineIdx = targetId - 1;
    if (lineIdx < 0 || lineIdx >= lines.length || !lines[lineIdx].trim()) {
      return res.status(404).json({ error: "entry not found" });
    }
    lines.splice(lineIdx, 1);
    const tmp = journalPath + ".tmp." + process.pid;
    fs.writeFileSync(tmp, lines.join("\n"));
    fs.renameSync(tmp, journalPath);
    res.json({ ok: true, deleted: targetId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Q-pass-3 — semantic search. Delegates to the kiro-memory MCP so the
// embedder stays in one place. Returns the same shape as /api/memory/list
// but ranked by similarity.
app.get("/api/memory/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ items: [] });
    const limit = Math.min(50, parseInt(String(req.query.limit || "20"), 10) || 20);
    let mcpItems = [];
    try {
      const r = await hub.callTool("memory__memory_search_vector", { query: q, limit });
      const text = (r?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("");
      // The MCP returns either a JSON array or a JSON object — be permissive.
      const m = text.match(/\[[\s\S]*\]/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed)) mcpItems = parsed;
      }
    } catch (mcpErr) {
      // MCP not available — fall back to the journal substring scan so the
      // UI still shows useful results.
      mcpItems = [];
    }
    if (mcpItems.length === 0) {
      // Fallback: substring match against the journal, ordered by recency.
      const all = _readJournalEntries();
      const filtered = _filterMemory(all, q);
      return res.json({ items: filtered.slice(0, limit), fallback: true });
    }
    // Map MCP rows to inspector shape (best-effort — keeps fields).
    const items = mcpItems.map((row, i) => ({
      id: row.rowid || i + 1,
      ts: row.timestamp ? Date.parse(row.timestamp) : 0,
      timestamp: row.timestamp || null,
      kind: row.kind || "task",
      category: row.outcome || (Array.isArray(row.tags) ? row.tags[0] : "general") || "general",
      summary: row.summary || "",
      details: row.details || "",
      lessons: row.lessons || "",
      outcome: row.outcome || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      files_touched: Array.isArray(row.files_touched) ? row.files_touched : [],
      confidence: typeof row.similarity === "number" ? Math.max(0.5, Math.min(1, row.similarity)) : 0.85,
      usedCount: 0,
      confirmedCount: 0,
      rejectedCount: 0,
      inferred: false,
      similarity: row.similarity ?? null,
    }));
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Q-pass-2 — Activity Feed routes.
import * as _feed from "./lib/feed/index.js";
import { readStakeholders as _readStakeholders, writeStakeholders as _writeStakeholders } from "./lib/feed/stakeholders.js";
app.get("/api/feed/items", (req, res) => {
  res.json({ items: _feed.getItems() });
});

// User directive 2026-05-30 — accept a suggested reply with one tick.
// Creates a DRAFT only (never auto-sends, per email_send_policy):
//   - outlook → email-mcp__email_reply { itemId, conversationId, body, saveDraft:true }
//   - slack   → chat-mcp__post_draft { channel, thread_ts, text }
// Body may include { text } to override the suggested reply (after edit).
app.post("/api/feed/items/:id/reply", express.json({ limit: "256kb" }), async (req, res) => {
  const id = req.params.id;
  const item = _feed.getItemById(id);
  if (!item) return res.status(404).json({ error: "feed item not found" });
  const replyText = (req.body?.text || item.suggestedReply || "").toString().trim();
  if (!replyText) return res.status(400).json({ error: "no reply text to draft" });
  try {
    if (item.source === "outlook") {
      const meta = item.meta || {};
      const r = await hub.callTool("email-mcp__email_reply", {
        itemId: meta.messageId,
        conversationId: meta.conversationId || meta.messageId,
        body: replyText.slice(0, 12000),
        saveDraft: true,
        format: "html",
      });
      const isError = !!r?.isError;
      if (!isError) _feed.markHandled(id);
      return res.json({ ok: !isError, drafted: !isError, platform: "outlook",
        error: isError ? (r?.content || []).map((b) => b.text).join("") : null });
    }
    if (item.source === "slack") {
      const meta = item.meta || {};
      const r = await hub.callTool("chat-mcp__post_draft", {
        channel: meta.channel,
        thread_ts: meta.ts,
        text: replyText.slice(0, 12000),
      });
      const isError = !!r?.isError;
      if (!isError) _feed.markHandled(id);
      return res.json({ ok: !isError, drafted: !isError, platform: "slack",
        error: isError ? (r?.content || []).map((b) => b.text).join("") : null });
    }
    return res.status(400).json({ error: `reply not supported for source '${item.source}'` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// Phase D (P0-4) — stakeholder model CRUD. Seeds from known vendor
// contacts + manager on first read.
app.get("/api/feed/stakeholders", (req, res) => {
  try {
    res.json(_readStakeholders());
  } catch (e) {
    res.status(500).json({ error: e.message, people: [] });
  }
});
app.post("/api/feed/stakeholders", express.json({ limit: "256kb" }), (req, res) => {
  try {
    const out = _writeStakeholders(req.body || {});
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});
app.post("/api/feed/items/:id/read", express.json(), (req, res) => {
  _feed.markRead(req.params.id);
  res.json({ ok: true });
});
app.post("/api/feed/items/:id/dismiss", express.json(), (req, res) => {
  _feed.dismiss(req.params.id);
  res.json({ ok: true });
});
// Q-pass-5 P1-3 — Mark a feed item as "handled". Reduces its relevance
// score so future similar items rank lower.
app.post("/api/feed/items/:id/handled", express.json(), (req, res) => {
  if (typeof _feed.markHandled !== "function") {
    return res.status(501).json({ ok: false, error: "markHandled not supported" });
  }
  _feed.markHandled(req.params.id);
  res.json({ ok: true });
});
app.get("/api/feed/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  // Initial snapshot.
  res.write(`data: ${JSON.stringify({ type: "snapshot", items: _feed.getItems() })}\n\n`);
  const ev = _feed.getEvents();
  const onItem = (it) => {
    try { res.write(`data: ${JSON.stringify({ type: "item", item: it })}\n\n`); } catch {}
  };
  const onRead = (id) => {
    try { res.write(`data: ${JSON.stringify({ type: "read", id })}\n\n`); } catch {}
  };
  // P2-5 — also relay dismiss + handled so other open tabs/windows don't
  // drift (a card dismissed in the full window should vanish in the owl).
  const onDismiss = (id) => {
    try { res.write(`data: ${JSON.stringify({ type: "dismiss", id })}\n\n`); } catch {}
  };
  const onHandled = (id) => {
    try { res.write(`data: ${JSON.stringify({ type: "handled", id })}\n\n`); } catch {}
  };
  ev.on("item", onItem);
  ev.on("read", onRead);
  ev.on("dismiss", onDismiss);
  ev.on("handled", onHandled);
  req.on("close", () => {
    ev.off("item", onItem);
    ev.off("read", onRead);
    ev.off("dismiss", onDismiss);
    ev.off("handled", onHandled);
  });
});

// Phase Q19 — Polly Talkback. Server-side synthesis over the existing
// your-aws-profile AWS profile. Cached on disk under ~/.ares/cache/polly/.
import { synthesize as _pollySynth, listVoices as _pollyVoices } from "./lib/talkback.js";
app.get("/api/talkback/voices", (req, res) => {
  res.json({ voices: _pollyVoices() });
});
app.get("/api/talkback", async (req, res) => {
  const text = String(req.query.text || "").trim();
  const voice = String(req.query.voice || "Joanna");
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const { buffer, cached, voice: v } = await _pollySynth({ text, voice });
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Polly-Cached", cached ? "1" : "0");
    res.setHeader("X-Polly-Voice", v);
    res.end(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Q-pass-3 (D) — Customization page server endpoints ────────────
//
// All five endpoints sit behind the standard auth middleware (Host +
// Bearer).
import {
  readConfig as _readFeedConfig,
  writeConfig as _writeFeedConfig,
  readInstructions as _readFeedInstructions,
  writeInstructions as _writeFeedInstructions,
} from "./lib/feed-config.js";
import { testDebugConnection as _testBrowserDebug } from "./lib/browser-debug.js";
import { buildDiagnosticsArchive as _buildDiagnostics, SINCE_OPTIONS as _DIAG_SINCE } from "./lib/diagnostics.js";

app.get("/api/feed/config", (req, res) => {
  try { res.json(_readFeedConfig()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/feed/config", express.json({ limit: "32kb" }), (req, res) => {
  try {
    const next = _writeFeedConfig(req.body || {});
    res.json(next);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/feed/instructions", (req, res) => {
  try { res.json(_readFeedInstructions()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/feed/instructions", express.json({ limit: "256kb" }), (req, res) => {
  try {
    const next = _writeFeedInstructions(req.body || {});
    res.json(next);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/browser/test-debug-connection", express.json({ limit: "4kb" }), async (req, res) => {
  try {
    const r = await _testBrowserDebug({
      port: Number(req.body?.port) || undefined,
      host: typeof req.body?.host === "string" ? req.body.host : undefined,
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/diagnostics", async (req, res) => {
  const since = String(req.query.since || "1h");
  if (!Object.prototype.hasOwnProperty.call(_DIAG_SINCE, since)) {
    return res.status(400).json({ error: "since must be 1h, 2h, 6h, 24h, or all" });
  }
  try {
    const buf = await _buildDiagnostics({ since, sessionsDir: SESSIONS_DIR });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition",
      `attachment; filename="ares-diagnostics-${since}-${stamp}.tar.gz"`);
    res.setHeader("X-Ares-Bundle-Bytes", String(buf.length));
    res.end(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Factory reset is destructive. Per the global Production Safety rule
// we never wipe user data without explicit consent — this endpoint is
// Phase Q16 + Q-pass-4 (E) — SOUL.md / personality hot-reload. Rebuilds
// the system prompt from disk + the current MCP catalog WITHOUT a server
// restart, then refreshes the per-session caches in-memory.
//
// Body: { sessionIds?: string[] }   omit → reload for all sessions
// Response: { ok: true, reloaded: <count>, errors: [...], length }
import { reloadSystemPrompt as _reloadSystemPrompt } from "./lib/system-prompt-reload.js";
app.post("/api/system-prompt/reload", express.json({ limit: "16kb" }), async (req, res) => {
  try {
    const sessionIds = Array.isArray(req.body?.sessionIds) ? req.body.sessionIds : undefined;
    const r = await _reloadSystemPrompt({
      sessions, hub, workspaceRoot: WORKSPACE_ROOT, sessionIds,
    });
    if (r.prompt) systemPrompt = r.prompt;
    res.json({ ok: true, reloaded: r.reloaded, errors: r.errors, length: r.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Q-pass-4 (E) — empty-state suggestion chips (memory + skills + seeds).
import { getSuggestions as _getSuggestions, _clearCache as _clearSuggestionsCache } from "./lib/suggestions.js";
app.get("/api/suggestions", async (req, res) => {
  try {
    const r = await _getSuggestions({ hub });
    res.json({ suggestions: r.suggestions, cached: r.cached });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Q-pass-4 (E) — unified activity-stream SSE (jobs + gateway + approvals
// + errors + memory). Single channel for the Q shell's right rail.
import {
  handleActivityStream as _handleActivityStream,
  subscribe as _subscribeActivity,
} from "./lib/activity-stream.js";
app.get("/api/activity/stream", _handleActivityStream);

// Q-pass-4 (E) — approval lifecycle SSE. Subscribes to the activity bus
// and forwards only the approval-source frames. Lets a UI tab interested
// in approvals only avoid filtering the firehose.
app.get("/api/approvals/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  try { res.write(`data: ${JSON.stringify({ type: "hello", ts: Date.now() })}\n\n`); } catch {}
  const off = _subscribeActivity((ev) => {
    if (ev?.source !== "approvals") return;
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch {}
  });
  req.on("close", () => off());
});

// Q-pass-4 (E) — personality presets. List / select.
import {
  listPersonalities as _listPersonalities,
  selectPersonality as _selectPersonality,
} from "./lib/personalities.js";
app.get("/api/personalities", (req, res) => {
  try {
    res.json({ personalities: _listPersonalities() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/personalities/:name/select", express.json({ limit: "4kb" }), async (req, res) => {
  try {
    const r = _selectPersonality(req.params.name);
    // Internally trigger the system-prompt reload so the persona files
    // we just copied take effect immediately.
    const reloaded = await _reloadSystemPrompt({
      sessions, hub, workspaceRoot: WORKSPACE_ROOT,
    });
    if (reloaded.prompt) systemPrompt = reloaded.prompt;
    res.json({
      ok: true,
      name: r.name,
      copied: r.copied,
      skipped: r.skipped,
      reloaded: reloaded.reloaded,
    });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ ok: false, error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Q-pass-4 work-stream F — slow-mo dev toggle. Accepts `?slow=N` where
// N is 1..10 (default 4 for the legacy `slow=1` cookie path). The
// browser side reads the multiplier on boot and sets
// `<html data-anim-slow="N">` so the tokens.css ladder takes effect.
//
// Back-compat: the legacy `?slow=1` flow set a cookie that anim.js read
// and toggled `data-anim-slow="1"` (which mapped to 4×). We keep that
// behaviour: passing `slow=1` maps to multiplier 4 in the response so
// the token ladder still resolves to the historical 480 / 800 / 1280 ms.
// Pass `slow=0` (or omit) to disable.
app.get("/api/dev/anim", (req, res) => {
  const raw = req.query.slow;
  let n = 0;
  if (raw === undefined || raw === "" || raw === "0" || raw === "off") {
    n = 0;
  } else {
    const parsed = parseInt(String(raw), 10);
    if (Number.isFinite(parsed)) n = Math.max(0, Math.min(10, parsed));
  }
  // Keep the legacy "ares-anim-slow=1" cookie alive for the legacy UI's
  // anim.js reader. Any other multiplier writes its own cookie too so
  // the legacy path can opt in to the new ladder.
  if (n === 1) {
    res.setHeader("Set-Cookie",
      "ares-anim-slow=1; Path=/; SameSite=Strict; Max-Age=86400");
  } else if (n >= 2) {
    res.setHeader("Set-Cookie",
      `ares-anim-slow=${n}; Path=/; SameSite=Strict; Max-Age=86400`);
  } else {
    res.setHeader("Set-Cookie", "ares-anim-slow=; Path=/; SameSite=Strict; Max-Age=0");
  }
  res.json({ ok: true, slow: n >= 1, multiplier: n });
});

app.get("/api/health", (req, res) => {
  const all = hub.listServers();
  res.json({
    ok: true,
    model: MODEL_ID,
    region: REGION,
    profile: PROFILE || "default",
    servers: {
      total: all.length,
      running: all.filter((s) => s.state === "running").length,
      active: all.filter((s) => s.active).length,
    },
    totalTools: all.reduce((n, s) => n + s.toolCount, 0),
    activeTools: hub.getClaudeTools().length,
    workspace: WORKSPACE_ROOT,
    // Phase U04 — surface prompt-cache state so the UI / doctor probe can
    // show the user whether caching is active.
    promptCache: cacheStatus(),
    // Phase U09 — surface sandbox backend so the header chip / tray
    // toggle can render without a second round-trip.
    sandbox: sandboxStatus(),
  });
});

// Phase 9 — Prometheus-style metrics scrape + JSON snapshot. Public
// (auth-exempt) so external monitoring can poll without the bearer
// token. Returns text by default; ?format=json for the human-friendly
// shape.
// D-10: 5 s cache. Pre-fix every Prom scrape did a fresh
// snapshotJson() / renderPromText() — both materialise every histogram
// (with the 4a ring-buffer fix that's an O(N) slice + sort per route).
// Prom polling at 1 Hz with multiple bucketed routes adds up. Cache.
let _metricsCache = { textAt: 0, text: null, jsonAt: 0, json: null };
app.get("/api/metrics", (req, res) => {
  const now = Date.now();
  if (req.query.format === "json") {
    if (!_metricsCache.json || now - _metricsCache.jsonAt > 5000) {
      _metricsCache = { ..._metricsCache, jsonAt: now, json: snapshotJson() };
    }
    res.json(_metricsCache.json);
  } else {
    if (!_metricsCache.text || now - _metricsCache.textAt > 5000) {
      _metricsCache = { ..._metricsCache, textAt: now, text: renderPromText() };
    }
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(_metricsCache.text);
  }
});

app.get("/api/models", (req, res) => {
  res.json(MODELS);
});

// Q-pass-5 P1-5 — SQLite mirror stats. Returns row counts per table
// + last-clean-shutdown timestamp + queue depth. Used by the audit
// gate, the doctor probe, and any future "rebuild mirror" UI.
app.get("/api/mirror/stats", (req, res) => {
  try {
    const stat = _mirrorFlushAndStat();
    if (!stat) return res.status(503).json({ ok: false, error: "mirror not initialised" });
    res.json({ ok: true, ...stat });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Q-pass-5 P1-5 — manual rebuild trigger. Runs the same import the
// boot path runs on unclean shutdown. Useful when a manual JSONL edit
// drifts from the mirror.
app.post("/api/mirror/rebuild", async (req, res) => {
  try {
    const result = await _mirrorRebuild({ sessionsDir: SESSIONS_DIR });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Quick credentials liveness check. Returns { ok: true } when the AWS
// credential chain can resolve a set of creds for the configured profile,
// or { ok: false, needsAuth: true, error, reason } otherwise. The UI's
// cred-error banner uses this before retrying a send.
import { fromNodeProviderChain as fromNodeProviderChainCheck } from "@aws-sdk/credential-providers";
app.get("/api/aws-check", async (req, res) => {
  try {
    const provider = fromNodeProviderChainCheck(PROFILE ? { profile: PROFILE } : {});
    const creds = await provider();
    const hasExpiry = creds.expiration instanceof Date;
    const expired = hasExpiry && creds.expiration.getTime() <= Date.now();
    if (expired) {
      return res.json({
        ok: false,
        needsAuth: true,
        reason: "expired",
        error: `Credentials expired at ${creds.expiration.toISOString()}`,
      });
    }
    res.json({
      ok: true,
      profile: PROFILE || "default",
      expiresAt: hasExpiry ? creds.expiration.toISOString() : null,
    });
  } catch (err) {
    const msg = (err && err.message) || String(err);
    const needsAuthProvider = /You need to authenticate with AuthProvider/i.test(msg) || /auth-init/i.test(msg);
    res.status(200).json({
      ok: false,
      needsAuth: true,
      reason: needsAuthProvider ? "auth-provider-required" : "missing",
      error: msg,
    });
  }
});

app.get("/api/mcps", (req, res) => {
  res.json(hub.listServers());
});

app.post("/api/mcps/:name/activate", async (req, res) => {
  try {
    const r = await hub.activate(req.params.name);
    if (!r.active) return res.status(502).json({ error: r.error || "failed to start" });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/mcps/:name/deactivate", async (req, res) => {
  try {
    const r = await hub.deactivate(req.params.name);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Manual connect/disconnect from the MCP tab (2026-05-30). These persist
// a per-server override so the choice survives restarts.
app.post("/api/mcps/:name/connect", async (req, res) => {
  try {
    const r = await hub.connect(req.params.name);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/mcps/:name/disconnect", async (req, res) => {
  try {
    const r = await hub.disconnect(req.params.name);
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get("/api/tools", (req, res) => {
  // Phase U16 — honour ?platform=… to filter the tool list. We base the
  // visible set on hub.getClaudeTools(platform) — that's the same list
  // the agent loop sees, so /api/tools and /api/chat agree.
  const platform = typeof req.query.platform === "string" ? req.query.platform : null;
  const claudeTools = hub.getClaudeTools ? hub.getClaudeTools(platform) : [];
  const visible = new Set(claudeTools.map((t) => t.name));
  const all = [];
  // Meta-tools first.
  for (const t of claudeTools) {
    if (t.name.startsWith("ares_")) {
      all.push({ name: t.name, server: "ares-meta", tool: t.name, description: t.description, active: true });
    }
  }
  // Server-backed tools — only those that survived the platform filter.
  for (const [name, s] of hub.state) {
    if (s.state !== "running") continue;
    for (const t of s.tools) {
      if (!visible.has(t.name)) continue;
      all.push({
        name: t.name,
        server: name,
        tool: t.toolName,
        description: t.description,
        active: true,
      });
    }
  }
  res.json(all);
});

app.get("/api/sessions", (req, res) => {
  // Enrich each session row with live streaming state so the sidebar can
  // render a spinner/dot on rows whose run is still in flight, even when
  // the user is viewing a different session.
  const rows = listSessionsFromDisk().map((row) => {
    const live = activeStreams.get(row.id);
    return live
      ? { ...row, streamActive: true, streamStartedAt: live.startedAt, streamModel: live.model, streamMode: live.mode }
      : row;
  });
  res.json(rows);
});

// Cross-session search. Hits every .rag.db on disk, applies optional date
// window, returns ranked hits with sessionId so the UI / agent can deep-link.
// Query params:
//   q        — required, the search string
//   k        — top-K hits (default 12, max 50)
//   sinceMs  — earliest turn ts to consider
//   untilMs  — latest turn ts to consider
//   sinceDays / untilDays — convenience: relative window
//   exclude  — optional sessionId to exclude (e.g. the current chat)
app.get("/api/sessions/search", async (req, res) => {
  const q = (req.query.q || "").toString();
  if (!q.trim()) return res.status(400).json({ error: "q required" });
  const k = Math.min(parseInt(req.query.k || "12", 10) || 12, 50);
  const sinceDays = req.query.sinceDays ? parseFloat(req.query.sinceDays) : null;
  const untilDays = req.query.untilDays ? parseFloat(req.query.untilDays) : null;
  const sinceMs = req.query.sinceMs ? parseInt(req.query.sinceMs, 10)
                : sinceDays != null ? Date.now() - sinceDays * 86400000 : null;
  const untilMs = req.query.untilMs ? parseInt(req.query.untilMs, 10)
                : untilDays != null ? Date.now() - untilDays * 86400000 : null;
  try {
    const hits = await searchAcrossSessions({
      sessionsDir: SESSIONS_DIR,
      query: q,
      k,
      sinceMs,
      untilMs,
      excludeSessionId: req.query.exclude || null,
    });
    // Enrich each hit with the session title for nicer UI rendering
    const titlesById = new Map();
    for (const row of listSessionsFromDisk()) titlesById.set(row.id, row.title);
    res.json(hits.map((h) => ({
      sessionId: h.sessionId,
      sessionTitle: titlesById.get(h.sessionId) || "(untitled)",
      seq: h.seq,
      role: h.role,
      ts: h.ts,
      text: (h.text || "").slice(0, 1200),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Q-pass-3 (work-stream C) — flat artifact index across every session.
// Drives the /q/#/my-stuff page. The aggregator lives in
// lib/artifact-index.js so unit tests can hit it without booting Express.
app.get("/api/artifacts", (req, res) => {
  try {
    const items = listArtifactRecords({
      sessionsDir: SESSIONS_DIR,
      uploadsRoot: UPLOADS_ROOT,
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// D-4: 5 s cache. Pre-fix every poll did sync readdir + listIndexedSessions
// (another readdir). UI polls this regularly; cache cuts the syscalls.
let _indexStatsCache = { at: 0, body: null };
app.get("/api/sessions/index-stats", (req, res) => {
  const now = Date.now();
  if (_indexStatsCache.body && now - _indexStatsCache.at < 5000) {
    return res.json(_indexStatsCache.body);
  }
  const all = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json")).length;
  const indexed = listIndexedSessions({ sessionsDir: SESSIONS_DIR }).length;
  const body = { totalSessions: all, indexedSessions: indexed, missing: all - indexed };
  _indexStatsCache = { at: now, body };
  res.json(body);
});

app.get("/api/sessions/:id", (req, res) => {
  const data = loadSessionFromDisk(req.params.id);
  if (!data) return res.status(404).json({ error: "not found" });
  const active = activeStreams.get(req.params.id) || null;
  const cp = readCheckpoint(req.params.id);
  res.json({
    ...data,
    title: deriveTitle(data),
    streamActive: !!active,
    stream: active,
    resumable: !!cp,
    resume: cp ? { iteration: cp.iteration, messageCount: cp.workingMessages?.length || 0, updatedAt: cp.updatedAt, mode: cp.mode, model: cp.model } : null,
  });
});

// Lightweight endpoint for polling: returns just whether a stream is active
// for this session + the current message count (so the client can tell if
// new state was persisted since the last poll without downloading the full
// session on every tick).
app.get("/api/sessions/:id/stream-status", (req, res) => {
  // D-6: avoid the full loadSessionFromDisk (migration + repair) on this
  // poll-heavy route. Pull updatedAt + messageCount from the projection
  // cache (mtime-keyed). The cache is refreshed by listSessionsFromDisk
  // which the same UI also polls.
  const active = activeStreams.get(req.params.id) || null;
  const id = req.params.id;
  let updatedAt = null, messageCount = 0;
  try {
    const p = path.join(SESSIONS_DIR, `${id}.json`);
    if (fs.existsSync(p)) {
      const mtimeMs = fs.statSync(p).mtimeMs;
      let cached = _sessionListCache.get(id);
      if (!cached || cached.mtimeMs !== mtimeMs) {
        const projection = _projectSession(p);
        cached = { mtimeMs, projection };
        _sessionListCache.set(id, cached);
      }
      if (cached.projection) {
        updatedAt = cached.projection.updatedAt || null;
        messageCount = cached.projection.messageCount || 0;
      }
    }
  } catch {}
  res.json({
    active: !!active,
    startedAt: active?.startedAt || null,
    mode: active?.mode || null,
    model: active?.model || null,
    updatedAt,
    messageCount,
  });
});

// Explicit Stop: abort the in-flight run for this session. Called by the
// browser's Stop button. This is the ONLY path that kills server-side
// work — socket close from refresh/tab-close/network drop does not.
app.post("/api/sessions/:id/stop", (req, res) => {
  const sessionId = req.params.id;
  // Phase U06 — also drop any pending approval so the loop unblocks.
  approvalRegistry.cancel(sessionId, "run stopped");
  // B-15: abort EVERY in-flight controller for this session, not just one.
  const aborted = abortRuns(sessionId);
  if (aborted === 0) {
    return res.status(404).json({ stopped: false, reason: "no active run" });
  }
  // Don't delete from activeRuns here — each run's own cleanup path will
  // do that once the AbortError propagates out of agent.run()/orchestrator.run().
  res.json({ stopped: true, aborted });
});

// ─── Q-pass-5 P0-2 — Send to background ─────────────────────────────
//
// Detaches the active SSE consumer for this session so the browser
// can move on, while the server-side run continues unmodified. The
// stream log keeps writing so any later tab can re-attach via
// /api/sessions/:id/stream-tail — that's already how /stream-tail
// works. We just flip a per-session "bg" flag so the UI knows to
// surface a bg badge + a "completed in background" notification when
// the run finishes.
const _backgroundRuns = new Map(); // sessionId -> { startedAt, label }
app.post("/api/sessions/:id/move-to-background", express.json(), (req, res) => {
  const sessionId = req.params.id;
  const set = activeRuns.get(sessionId);
  if (!set || set.size === 0) {
    return res.status(404).json({ ok: false, reason: "no active run" });
  }
  // Tag every controller in the set as backgrounded — the SSE pump
  // checks this each event and skips browser writes once true. Server
  // work continues unchanged.
  for (const c of set) c._aresBackgrounded = true;
  _backgroundRuns.set(sessionId, {
    startedAt: Date.now(),
    label: (req.body?.label || "running in background").slice(0, 80),
  });
  // Surface as a feed item so the user sees it in Activity Feed.
  try {
    import("./lib/feed/index.js").then(({ pushItem }) => {
      pushItem({
        id: `bg-${sessionId}-${Date.now()}`,
        type: "background-task",
        source: "system",
        title: "Task moved to background",
        body: `Continuing in session ${sessionId.slice(0, 8)}…`,
        ts: Date.now(),
      });
    }).catch(() => {});
  } catch {}
  res.json({ ok: true, sessionId, label: _backgroundRuns.get(sessionId)?.label });
});

app.get("/api/sessions/:id/background-status", (req, res) => {
  const entry = _backgroundRuns.get(req.params.id);
  if (!entry) return res.json({ background: false });
  res.json({ background: true, ...entry });
});

// ─── Phase U06 — approval / dangerous-command endpoints ───────────────
//
// The agent's approvalGate enqueues a pending entry and blocks. The UI
// (browser, compact panel, Electron tray) polls /api/runs/pending-approvals
// and, when the user decides, hits /api/sessions/:id/approve or /deny to
// resolve.

app.get("/api/runs/pending-approvals", (req, res) => {
  res.json({ pending: approvalRegistry.list() });
});

// Q-pass-4 work-stream D — compact endpoint used by the header
// "pending approvals" status chip. Returns just the count so the
// poll loop is cheap. Body shape: { count: N }.
app.get("/api/approvals/pending", (req, res) => {
  const list = approvalRegistry.list();
  res.json({ count: Array.isArray(list) ? list.length : 0 });
});

app.get("/api/sessions/:id/approval", (req, res) => {
  const entry = approvalRegistry.get(req.params.id);
  if (!entry) return res.status(404).json({ pending: false });
  res.json({ pending: true, approval: entry });
});

app.post("/api/sessions/:id/approve", express.json(), (req, res) => {
  // B-21: expectedId guards against a stale tab showing an old approval
  // id and clicking Approve when a *different* approval is now pending.
  const expectedId = req.body?.approvalId || null;
  const ret = approvalRegistry.resolve(req.params.id, "approve", req.body?.reason, { expectedId });
  if (expectedId) {
    if (!ret.ok) return res.status(409).json({ resolved: false, reason: ret.reason });
    return res.json({ resolved: true, decision: "approve" });
  }
  if (!ret) return res.status(404).json({ resolved: false, reason: "no pending approval" });
  res.json({ resolved: true, decision: "approve" });
});

app.post("/api/sessions/:id/deny", express.json(), (req, res) => {
  const expectedId = req.body?.approvalId || null;
  const ret = approvalRegistry.resolve(req.params.id, "deny", req.body?.reason, { expectedId });
  if (expectedId) {
    if (!ret.ok) return res.status(409).json({ resolved: false, reason: ret.reason });
    return res.json({ resolved: true, decision: "deny" });
  }
  if (!ret) return res.status(404).json({ resolved: false, reason: "no pending approval" });
  res.json({ resolved: true, decision: "deny" });
});

// Resume a crashed long run from its most recent checkpoint. Loads the
// on-disk checkpoint, re-enters the agent loop with the saved working
// transcript as the starting point, and streams the continuation. Uses
// the same SSE contract as /api/chat so the client's stream consumer
// can handle it without changes.
app.post("/api/sessions/:id/resume-run", async (req, res) => {
  const sessionId = req.params.id;
  const cp = readCheckpoint(sessionId);
  if (!cp) {
    return res.status(404).json({ error: "no checkpoint for this session" });
  }
  const session = loadSessionFromDisk(sessionId) || {
    id: sessionId, messages: [], createdAt: Date.now(),
  };
  const resolvedModelId = cp.model || MODEL_ID;

  activeStreams.set(sessionId, { startedAt: Date.now(), mode: cp.mode, model: resolvedModelId, resumed: true });
  openStreamLog(sessionId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  let clientDisconnected = false;
  // B-15: resume-run is also a run on this session; register its controller
  // so /stop aborts it alongside any concurrent /chat run.
  const runAbort = new AbortController();
  registerRun(sessionId, runAbort);
  res.on("close", () => { clientDisconnected = true; });
  const send = (obj) => {
    appendStreamEvent(sessionId, obj);
    if (clientDisconnected) return;
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {}
  };
  send({ type: "model_info", model: resolvedModelId, mode: cp.mode || "standard", routing: "smart", requestedModel: resolvedModelId, resumed: true, resumedFromIteration: cp.iteration, preflight: true });

  const saveProgress = (messages) => {
    if (!messages || messages.length <= 1) return;
    const priorLen = session.messages.length;
    if (messages.length > priorLen) {
      const newMessages = messages.slice(priorLen);
      for (const m of newMessages) {
        session.messages.push({ ...m });
      }
    } else {
      // Compressed but may have a new assistant response at the end.
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        const diskLast = session.messages[session.messages.length - 1];
        const alreadySaved = diskLast?.role === "assistant" &&
          JSON.stringify(diskLast.content) === JSON.stringify(last.content);
        if (!alreadySaved) {
          session.messages.push({ ...last });
        }
      }
    }
    session.updatedAt = Date.now();
    saveSessionToDisk(sessionId, session);
  };

  let finalMessages = null;
  const chatBedrock = bedrockFactory(resolvedModelId);
  const agent = new Agent({
    bedrock: chatBedrock,
    hub,
    systemPrompt,
    approvalGate: makeApprovalGate(sessionId),
  });

  try {
    for await (const ev of agent.run(cp.workingMessages || [], { abortSignal: runAbort.signal })) {
      if (ev.type === "checkpoint") {
        writeCheckpoint(sessionId, {
          iteration: ev.iteration,
          mode: cp.mode,
          model: resolvedModelId,
          workingMessages: ev.messages,
          createdAt: cp.createdAt || Date.now(),
        });
        continue;
      }
      send(ev);
      if (ev.type === "done") { finalMessages = ev.finalMessages; saveProgress(finalMessages); }
      if (ev.type === "progress") saveProgress(ev.messages);
      if (ev.type === "error") break;
    }
  } catch (err) {
    send({ type: "error", error: err.message });
  }
  if (!finalMessages) saveProgress(cp.workingMessages || []);

  activeStreams.delete(sessionId);
  unregisterRun(sessionId, runAbort);
  deleteCheckpoint(sessionId);
  send({ type: "end" });
  closeStreamLog(sessionId);
  res.end();
});

// Lightweight endpoint telling the UI whether a resumable checkpoint
// exists for a session. Used on page load to decide whether to show a
// "Resume (N iterations done)" banner.
app.get("/api/sessions/:id/resume-status", (req, res) => {
  const cp = readCheckpoint(req.params.id);
  if (!cp) return res.json({ resumable: false });
  res.json({
    resumable: true,
    iteration: cp.iteration,
    mode: cp.mode,
    model: cp.model,
    messageCount: cp.workingMessages?.length || 0,
    updatedAt: cp.updatedAt,
  });
});

// Resume an in-flight stream mid-flight. Replays the on-disk stream log
// from `fromSeq` (default 0) and then tails newly-written events until
// the original stream ends. If the stream is already finished, the
// endpoint still plays back everything in the log and closes cleanly —
// so the client's handlers get the same events they would have received
// in real time.
app.get("/api/sessions/:id/stream-tail", (req, res) => {
  const sessionId = req.params.id;
  const fromSeq = parseInt(req.query.fromSeq || "0", 10) || 0;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let clientGone = false;
  let lastSeq = fromSeq;
  const write = (entry) => {
    if (clientGone) return;
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch {}
  };
  res.on("close", () => { clientGone = true; });

  // 1) Replay anything already on disk (fast, synchronous).
  for (const entry of readStreamLog(sessionId, fromSeq)) {
    write(entry);
    lastSeq = entry.seq;
  }

  // 2) If the stream is still running, tail live events via the emitter.
  const state = streamLogState.get(sessionId);
  if (!state) {
    // Stream already finished → close immediately.
    try { res.write(`data: ${JSON.stringify({ type: "tail_end" })}\n\n`); } catch {}
    res.end();
    return;
  }

  const onEntry = (entry) => {
    if (clientGone) return;
    if (entry.seq <= lastSeq) return;
    write(entry);
    lastSeq = entry.seq;
  };
  const onClosed = () => {
    if (clientGone) return;
    try { res.write(`data: ${JSON.stringify({ type: "tail_end" })}\n\n`); } catch {}
    res.end();
  };
  state.emitter.on("entry", onEntry);
  state.emitter.once("closed", onClosed);

  // Drain anything that landed between the disk read and the subscribe —
  // possible under load on a slow disk. Reads the log again from lastSeq.
  for (const entry of readStreamLog(sessionId, lastSeq)) {
    write(entry);
    lastSeq = entry.seq;
  }

  // Clean up listeners on client disconnect.
  res.on("close", () => {
    state.emitter.off("entry", onEntry);
    state.emitter.off("closed", onClosed);
  });
});

app.post("/api/sessions", express.json({ limit: "4kb" }), (req, res) => {
  // If a client-supplied id is provided, validate it's a proper UUID.
  if (req.body?.id) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(req.body.id)) {
      return res.status(400).json({ error: "invalid session id: must be a valid UUID" });
    }
  }
  const id = req.body?.id || crypto.randomUUID();
  const data = { id, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
  saveSessionToDisk(id, data);
  res.json(data);
});

// Q-pass-5 P1-1 — branch a session at a specific user message index.
// Body: { fromMessageIdx: number, newText: string }
// Creates a new session whose messages = parent.messages[0..idx-1] +
// {role:"user", content:[{type:"text", text:newText}]}. Stores
// branchedFrom metadata so the dock can render a tree.
app.post("/api/sessions/:id/branch", express.json(), (req, res) => {
  const parent = loadSessionFromDisk(req.params.id);
  if (!parent) return res.status(404).json({ error: "parent session not found" });
  const fromIdx = parseInt(req.body?.fromMessageIdx, 10);
  const newText = (req.body?.newText || "").toString().trim();
  if (!Number.isFinite(fromIdx) || fromIdx < 0 || fromIdx >= (parent.messages || []).length) {
    return res.status(400).json({ error: "invalid fromMessageIdx" });
  }
  if (!newText) return res.status(400).json({ error: "newText required" });
  const newId = crypto.randomUUID();
  // Take everything BEFORE the message being edited, then append the
  // new user turn. The new user turn replaces parent.messages[fromIdx].
  const head = (parent.messages || []).slice(0, fromIdx);
  const newMessages = [
    ...head,
    { role: "user", content: [{ type: "text", text: newText }] },
  ];
  const titleBase = (parent.title || "untitled").toString().slice(0, 60);
  const data = {
    id: newId,
    title: `↪ ${titleBase}`,
    messages: newMessages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    branchedFrom: {
      parentSessionId: parent.id,
      parentMessageIdx: fromIdx,
      branchedAt: Date.now(),
    },
  };
  saveSessionToDisk(newId, data);
  res.json({ ok: true, sessionId: newId, branchedFrom: data.branchedFrom });
});

// Rename a session
app.patch("/api/sessions/:id", express.json(), (req, res) => {
  const data = loadSessionFromDisk(req.params.id);
  if (!data) return res.status(404).json({ error: "not found" });
  const title = (req.body?.title || "").toString().trim().slice(0, 140);
  if (!title) return res.status(400).json({ error: "title required" });
  data.title = title;
  data.updatedAt = Date.now();
  saveSessionToDisk(req.params.id, data);
  res.json({ id: req.params.id, title });
});

// Auto-generate a title via a small Bedrock call. Called after the first
// exchange completes. Uses a short model prompt to produce a concise title.
app.post("/api/sessions/:id/auto-title", async (req, res) => {
  try {
    const data = loadSessionFromDisk(req.params.id);
    if (!data) return res.status(404).json({ error: "not found" });
    if (data.title) return res.json({ id: req.params.id, title: data.title, skipped: true });
    const firstUser = firstUserTextFromMessages(data.messages) || "";
    if (!firstUser) return res.status(400).json({ error: "no user message yet" });

    // Keep prompt tiny and deterministic-ish
    const sample = firstUser.slice(0, 1000);
    const body = await bedrock.invoke({
      system: "You write short chat titles. Reply with 3-6 words, no quotes, no punctuation except spaces and hyphens. Describe the topic of the user's first message.",
      messages: [{ role: "user", content: [{ type: "text", text: sample }] }],
      max_tokens: 40,
    });
    const raw = body?.content?.find?.((c) => c.type === "text")?.text || "";
    const title = raw.replace(/["'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || deriveTitle(data);
    data.title = title;
    data.updatedAt = Date.now();
    saveSessionToDisk(req.params.id, data);
    res.json({ id: req.params.id, title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pin/unpin a session (pinned sessions appear at top of sidebar)
app.post("/api/sessions/:id/pin", (req, res) => {
  const data = loadSessionFromDisk(req.params.id);
  if (!data) return res.status(404).json({ error: "not found" });
  data.pinned = !data.pinned;
  data.updatedAt = Date.now();
  saveSessionToDisk(req.params.id, data);
  res.json({ id: req.params.id, pinned: data.pinned });
});

// Q-pass-5 close-out — deep-clone a session under a new id. The new
// session keeps every message + meta flag (steering, tier1Only, etc.)
// but gets a fresh id, "(copy)" title suffix, fresh timestamps, and
// loses any branchedFrom pointer (a duplicate is a stand-alone copy,
// not a branch). Useful when the user wants to fork a long session
// without going through the edit-message → branch flow.
app.post("/api/sessions/:id/duplicate", (req, res) => {
  const src = loadSessionFromDisk(req.params.id);
  if (!src) return res.status(404).json({ error: "not found" });
  const newId = crypto.randomUUID();
  // Deep clone via JSON round-trip so nested message blocks aren't
  // shared by reference. Sessions are JSON anyway so this is safe.
  let cloned;
  try {
    cloned = JSON.parse(JSON.stringify(src));
  } catch (err) {
    return res.status(500).json({ error: "clone failed: " + err.message });
  }
  cloned.id = newId;
  cloned.title = ((src.title || "Untitled").toString().slice(0, 56)) + " (copy)";
  cloned.createdAt = Date.now();
  cloned.updatedAt = Date.now();
  // A duplicate is independent of the source, not a branch.
  delete cloned.branchedFrom;
  // Drop pin state so the copy doesn't double up at the top of the sidebar.
  delete cloned.pinned;
  // Drop any in-flight run markers — the original may still be streaming.
  delete cloned._aresBackgrounded;
  saveSessionToDisk(newId, cloned);
  res.json({ ok: true, sessionId: newId, title: cloned.title });
});

// Q-pass-5 close-out — per-session export. Returns a single JSON blob
// containing the full session payload (id, title, messages, branchedFrom,
// flags). Sets Content-Disposition so the browser downloads it as
// `<title>-<short-id>.json`. Use ?format=sharegpt for the OpenAI
// ShareGPT-style flat conversation array (drops tool turns).
app.get("/api/sessions/:id/export", (req, res) => {
  const src = loadSessionFromDisk(req.params.id);
  if (!src) return res.status(404).json({ error: "not found" });
  const format = String(req.query.format || "raw").toLowerCase();
  const slug = (src.title || "untitled")
    .toString()
    .slice(0, 60)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "session";
  const shortId = String(src.id || "").slice(0, 8);
  let payload;
  let filename;
  if (format === "sharegpt") {
    // Flatten to the `[{from, value}]` shape used by ShareGPT exports.
    // Tool calls + tool_results are dropped so the file imports cleanly
    // into other chat apps. Only text turns survive.
    const conversations = [];
    for (const m of (src.messages || [])) {
      if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
      let text = "";
      if (typeof m.content === "string") text = m.content;
      else if (Array.isArray(m.content)) {
        text = m.content
          .filter((b) => b?.type === "text")
          .map((b) => b.text || "")
          .join("\n\n")
          .trim();
      }
      if (!text) continue;
      conversations.push({
        from: m.role === "user" ? "human" : "gpt",
        value: text,
      });
    }
    payload = { id: src.id, title: src.title || "Untitled", conversations };
    filename = `${slug}-${shortId}.sharegpt.json`;
  } else {
    payload = src;
    filename = `${slug}-${shortId}.json`;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.end(JSON.stringify(payload, null, 2));
});

// ── Q-pass-4 work-stream A — token-budget recovery endpoints ──────────────
//
// /compress?pressure=N runs the active ContextEngine's compress at the
// given pressure (1–4, clamped) and writes the new transcript back to
// disk. Pressure 4 is engine-mapped to hardTruncate as a final safety net.
app.post("/api/sessions/:id/compress", express.json({ limit: "1kb" }), (req, res) => {
  const data = loadSessionFromDisk(req.params.id);
  if (!data) return res.status(404).json({ error: "not found" });
  const rawPressure = Number(req.query.pressure ?? req.body?.pressure ?? 2);
  const pressure = Math.max(1, Math.min(4, Math.floor(Number.isFinite(rawPressure) ? rawPressure : 2)));
  try {
    // Build a tiny throwaway Agent so we can reach the same context engine
    // + sanitizer the chat path uses. We never call .run() on it.
    const tmp = new Agent({
      bedrock: null,
      hub,
      systemPrompt: "",
    });
    const before = tmp._estimateTokens(data.messages || []);
    const beforeCount = (data.messages || []).length;
    let next = tmp._truncateLargeToolResults(data.messages || []);
    next = tmp._sanitizeMessages(next);
    // Map our 1–4 pressure scale onto the engine: 1/2 → compress(0/1),
    // 3 → compress(2), 4 → hardTruncate.
    const engineLevels = [0, 1, 2];
    const lvl = pressure <= 3 ? engineLevels[pressure - 1] : 2;
    next = tmp._sanitizeMessages(tmp._compressMessages(next, { pressure: lvl }));
    if (pressure >= 4) {
      next = tmp._sanitizeMessages(tmp._hardTruncate(next));
    }
    const after = tmp._estimateTokens(next);
    // Read-only: store a preview but do NOT overwrite the canonical messages.
    data._compressedPreview = next;
    data.updatedAt = Date.now();
    saveSessionToDisk(req.params.id, data);
    res.json({
      ok: true,
      pressure,
      beforeMessages: beforeCount,
      afterMessages: next.length,
      beforeTokens: before,
      afterTokens: after,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /strip-steering writes a session-scoped flag that tells the next
// agent.run() to rebuild its system prompt with the steering cap
// forced to 0. POST with {value:false} flips it back off.
app.post("/api/sessions/:id/strip-steering", express.json({ limit: "1kb" }), (req, res) => {
  const data = loadSessionFromDisk(req.params.id);
  if (!data) return res.status(404).json({ error: "not found" });
  const desired = req.body?.value !== undefined ? !!req.body.value : true;
  data._stripSteering = desired;
  data.updatedAt = Date.now();
  saveSessionToDisk(req.params.id, data);
  res.json({ ok: true, id: req.params.id, stripSteering: data._stripSteering });
});

// /trim-mcps writes a session-scoped flag that tells `_capTools` to
// drop EVERY non-Tier-1 tool on the next agent.run().
app.post("/api/sessions/:id/trim-mcps", express.json({ limit: "1kb" }), (req, res) => {
  const data = loadSessionFromDisk(req.params.id);
  if (!data) return res.status(404).json({ error: "not found" });
  const desired = req.body?.value !== undefined ? !!req.body.value : true;
  data._tier1Only = desired;
  data.updatedAt = Date.now();
  saveSessionToDisk(req.params.id, data);
  res.json({ ok: true, id: req.params.id, tier1Only: data._tier1Only });
});

// /api/dev/prompt-debug — return a per-layer breakdown of the prompt
// + tools list as the agent would assemble them for the given session.
// Auth-protected like every /api/* route.
app.get("/api/dev/prompt-debug", async (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });
    const session = loadSessionFromDisk(sessionId);
    if (!session) return res.status(404).json({ error: "session not found" });

    const caps = getSystemPromptCaps();
    const stripSteering = !!session._stripSteering;
    const tier1Only = !!session._tier1Only;
    const built = await buildSystemPromptDetailed({
      workspaceRoot: WORKSPACE_ROOT,
      mcpCatalog: hub.getCatalogForPrompt?.() || "",
      caps: stripSteering ? { ...caps, steering: 0 } : caps,
    });

    // Build the tool list and run the cap so we report what the agent
    // would actually send. Reuses the same Agent helper so behaviour
    // matches a real run.
    const fullTools = hub.getClaudeTools ? hub.getClaudeTools() : [];
    const tmp = new Agent({ bedrock: null, hub, systemPrompt: "" });
    const budgetTokens = Number(process.env.ARES_TOOL_SCHEMA_BUDGET) || 80000;
    const capRes = tmp._capTools(fullTools, budgetTokens, { tier1Only });
    const toolsTokens = Math.ceil((capRes.jsonChars || 0) / 2.6);
    const toolsTokensFull = Math.ceil(JSON.stringify(fullTools).length / 2.6);

    const transcriptTokens = tmp._estimateTokens(session.messages || []);

    const layers = {
      base:         { tokens: built.breakdown.base.tokens },
      persona:      { tokens: built.breakdown.persona.tokens, cap: built.breakdown.persona.cap },
      mcp_catalog:  { tokens: built.breakdown.mcp_catalog.tokens },
      steering: {
        tokens: built.breakdown.steering.tokens,
        cap: built.breakdown.steering.cap,
        files: built.breakdown.steering.files.map((f) => ({
          path: f.path, tokens: f.tokens, truncated: f.truncated,
        })),
      },
      environment:  { tokens: built.breakdown.environment.tokens },
      tools: {
        tokens: toolsTokens,
        tokensFull: toolsTokensFull,
        cap: budgetTokens,
        kept: capRes.keptCount,
        dropped: capRes.originalCount - capRes.keptCount,
        droppedTools: capRes.dropped,
        tier1Only,
      },
      transcript:   { tokens: transcriptTokens, messages: (session.messages || []).length },
    };

    const totalTokens = layers.base.tokens
      + layers.persona.tokens
      + layers.mcp_catalog.tokens
      + layers.steering.tokens
      + layers.environment.tokens
      + layers.tools.tokens
      + layers.transcript.tokens;

    const flat = [
      { name: "base", tokens: layers.base.tokens },
      { name: "persona", tokens: layers.persona.tokens },
      { name: "mcp_catalog", tokens: layers.mcp_catalog.tokens },
      { name: "steering", tokens: layers.steering.tokens },
      { name: "environment", tokens: layers.environment.tokens },
      { name: "tools", tokens: layers.tools.tokens },
      { name: "transcript", tokens: layers.transcript.tokens },
    ];
    flat.sort((a, b) => b.tokens - a.tokens);

    res.json({
      sessionId,
      totalTokens,
      bedrockSafeMax: 195000,
      bedrockMax: 200000,
      stripSteering,
      tier1Only,
      layers,
      topOffenders: flat,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/sessions/:id", requireUuidParam("id"), (req, res) => {
  // B-27: cancel any pending approval so the agent loop's awaited promise
  // doesn't leak forever. B-15: also abort any running controllers; the
  // session is gone, the run can't finish meaningfully.
  try { approvalRegistry.cancel(req.params.id, "session deleted"); } catch {}
  try { abortRuns(req.params.id); } catch {}
  const p = path.join(SESSIONS_DIR, `${req.params.id}.json`);
  if (fs.existsSync(p)) {
    // Archive before deleting (never lose data permanently)
    const archiveDir = path.join(__dirname, "sessions-archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, `${req.params.id}-${Date.now()}.json`);
    try { fs.copyFileSync(p, archivePath); } catch {}
    fs.unlinkSync(p);
  }
  // Drop the per-session RAG index too. We don't archive it; it can be
  // rebuilt from the JSON if the session is ever restored.
  try { dropSession({ sessionsDir: SESSIONS_DIR, sessionId: req.params.id }); } catch {}
  // D-18: also drop the checkpoint so a deleted session can't offer a
  // bogus resume next boot.
  try { deleteCheckpoint(req.params.id); } catch {}
  // uploads dir cleanup — when a session is archived, also drop its uploads
  // so the directory doesn't grow unbounded. Best-effort, never fails the
  // delete request.
  try {
    const updir = path.join(UPLOADS_ROOT, req.params.id);
    if (fs.existsSync(updir)) fs.rmSync(updir, { recursive: true, force: true });
  } catch {}
  // Q-pass-5 P1-5 — purge mirror rows so cross-session search doesn't
  // surface deleted sessions.
  try { _mirrorDeleteConversation(req.params.id); } catch {}
  res.json({ ok: true });
});

// Feedback endpoint — records user thumbs up/down via memory MCP
app.post("/api/sessions/:sessionId/feedback", async (req, res) => {
  try {
    const { messageIndex, rating, context } = req.body || {};
    if (!rating || !["positive", "negative"].includes(rating)) {
      return res.status(400).json({ error: "rating must be positive or negative" });
    }
    const summary = `User rated response ${rating}: "${(context || "").slice(0, 100)}"`;
    await hub.callTool("memory__memory_record", {
      summary,
      kind: "feedback",
      tags: ["feedback", rating],
      outcome: rating === "positive" ? "completed" : "failed",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[feedback] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Upload endpoint — stores multipart files under uploads/<sid>/, returns
// metadata the client echoes back to /api/chat. We re-read the file on
// chat to keep request sizes small.
// E-13: uploads rate limit. Localhost-only mitigates external abuse,
// but a runaway script (or a hostile process running as the user) could
// otherwise hammer /api/sessions/:id/upload at 1 GB per request. We
// cap concurrent uploads per session at 2; further requests get 429.
const _uploadInFlight = new Map(); // sessionId → count
function _uploadLimitGate(sessionId) {
  const cur = _uploadInFlight.get(sessionId) || 0;
  if (cur >= 2) return false;
  _uploadInFlight.set(sessionId, cur + 1);
  return true;
}
function _uploadLimitRelease(sessionId) {
  const cur = _uploadInFlight.get(sessionId) || 0;
  if (cur <= 1) _uploadInFlight.delete(sessionId);
  else _uploadInFlight.set(sessionId, cur - 1);
}

// D-17: per-session uploads quota. Pre-fix a single session could
// accumulate 50 MB × 20 files repeatedly with no GC until session
// delete. Cap each session's uploads dir at 250 MB; oldest files
// evicted when the cap is exceeded.
const UPLOADS_PER_SESSION_CAP_BYTES = 250 * 1024 * 1024;
function _enforceUploadsQuota(sessionId) {
  const dir = path.join(UPLOADS_ROOT, sessionId);
  if (!fs.existsSync(dir)) return;
  let entries;
  try { entries = fs.readdirSync(dir).map((name) => {
    const p = path.join(dir, name);
    try {
      const st = fs.statSync(p);
      return { name, p, size: st.size, mtime: st.mtimeMs };
    } catch { return null; }
  }).filter(Boolean); } catch { return; }
  let total = entries.reduce((s, e) => s + e.size, 0);
  if (total <= UPLOADS_PER_SESSION_CAP_BYTES) return;
  // Evict oldest until we're under the cap.
  entries.sort((a, b) => a.mtime - b.mtime);
  for (const e of entries) {
    if (total <= UPLOADS_PER_SESSION_CAP_BYTES) break;
    try { fs.unlinkSync(e.p); total -= e.size; } catch {}
  }
}

app.post("/api/sessions/:sessionId/upload", requireUuidParam("sessionId"), (req, res, next) => {
  // E-13: in-flight limiter — applied BEFORE multer so the 429 doesn't
  // wait for the body to upload.
  if (!_uploadLimitGate(req.params.sessionId)) {
    return res.status(429).json({ error: "too many concurrent uploads for this session" });
  }
  res.on("finish", () => _uploadLimitRelease(req.params.sessionId));
  res.on("close", () => _uploadLimitRelease(req.params.sessionId));
  next();
}, upload.array("files", 20), async (req, res) => {
  try {
    // D-17: enforce per-session quota AFTER the new files have landed
    // (multer has already written them). Worst case a single oversized
    // upload bursts past the cap briefly; we then evict oldest.
    try { _enforceUploadsQuota(req.params.sessionId); } catch {}
    const processed = [];
    for (const file of req.files || []) {
      // Determine kind using the same rules processUpload applies internally,
      // without actually building a Claude block (we'll build it on /chat).
      const ext = path.extname(file.originalname || "").toLowerCase();
      let mime = file.mimetype || "application/octet-stream";
      if (mime === "application/octet-stream") {
        if ([".txt",".md",".csv",".tsv",".json",".xml",".yaml",".yml",".html",".htm",".log",".py",".js",".ts",".tsx",".jsx",".sh",".sql",".java",".c",".cpp",".h",".rs",".go",".rb",".php"].includes(ext)) mime = "text/plain";
        else if ([".png",".jpg",".jpeg",".gif",".webp"].includes(ext)) mime = "image/" + (ext === ".jpg" ? "jpeg" : ext.slice(1));
        else if (ext === ".pdf") mime = "application/pdf";
      }
      let kind = "file";
      if (mime === "application/pdf") kind = "pdf";
      else if (mime.startsWith("image/")) kind = "image";
      else if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml") kind = "text";

      processed.push({
        id: crypto.randomUUID(),
        kind,
        name: file.originalname,
        mime,
        sizeBytes: file.size,
        path: file.path,
      });
    }
    res.json({ attachments: processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// /api/jobs — scheduled background jobs (morning brief, ticket watcher,
// vendor-mail resolver, COST_METRICS expiry, KPI cache). The JobRunner is started
// at boot once the system prompt is built. Every endpoint here just reads
// or pokes the runner's state.
// =====================================================================
let jobRunner = null;
let gatewayManager = null;

app.get("/api/jobs", (req, res) => {
  const projectStatic = (j) => {
    const state = getJobState(j.id);
    const recent = listRuns({ jobId: j.id, limit: 1 });
    return {
      id: j.id, title: j.title, description: j.description,
      defaultCron: j.defaultCron, cron: state?.cron || j.defaultCron,
      enabled: state ? state.enabled === 1 : true,
      lastRun: recent[0] || null, mcps: j.mcps || [], model: j.model,
      isDynamic: false,
    };
  };
  const projectDynamic = (d) => {
    const state = getJobState(d.id);
    const recent = listRuns({ jobId: d.id, limit: 1 });
    return {
      id: d.id, title: d.title, description: d.description,
      defaultCron: d.cron, cron: state?.cron || d.cron,
      enabled: state ? state.enabled === 1 : d.enabled,
      lastRun: recent[0] || null, mcps: d.mcps || [], model: d.model,
      prompt: d.prompt, attachSkills: d.attachSkills, deliver: d.deliver,
      isDynamic: true,
    };
  };
  let out = [
    ...JOBS.map(projectStatic),
    ...listDynamicJobs().map(projectDynamic),
  ];

  // Q-pass-4-C — `?upcoming=1` returns only jobs scheduled in the next 24h.
  // Each row is enriched with `nextRunAt` (epoch ms) and `estimatedDurationMs`
  // (defaults to 5 min — used by the activity-feed timeline to size blocks).
  if (req.query.upcoming === "1" || req.query.upcoming === "true") {
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000;
    out = out
      .filter((j) => j.enabled && j.cron)
      .map((j) => {
        let nextRunAt = null;
        try {
          const parsed = parseCronExpr(j.cron);
          if (parsed && typeof parsed.nextAfter === "function") {
            const d = parsed.nextAfter(new Date());
            if (d) nextRunAt = d.getTime();
          }
        } catch {}
        return {
          ...j,
          nextRunAt,
          // Best-effort default — most jobs run for a few minutes; the
          // timeline draws a min 36px block (1 row) when this is missing.
          estimatedDurationMs: j.estimatedDurationMs ?? 5 * 60 * 1000,
        };
      })
      .filter((j) => typeof j.nextRunAt === "number" && j.nextRunAt >= now && j.nextRunAt <= horizon)
      .sort((a, b) => (a.nextRunAt || 0) - (b.nextRunAt || 0));
  }

  res.json(out);
});

// ─── Phase U08 — dynamic-jobs CRUD ───
app.post("/api/jobs", express.json(), (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.cron || !body.prompt) {
    return res.status(400).json({ error: "title, cron, prompt are required" });
  }
  try {
    parseCronGuard(body.cron);
  } catch (e) {
    return res.status(400).json({ error: `bad cron: ${e.message}` });
  }
  const created = upsertDynamicJob({
    id: body.id, // optional — upsert decides
    title: body.title,
    description: body.description || "",
    cron: body.cron,
    enabled: body.enabled !== false,
    prompt: body.prompt,
    model: body.model || "sonnet",
    mcps: Array.isArray(body.mcps) ? body.mcps : [],
    attachSkills: body.attachSkills !== false,
    deliver: body.deliver || { kind: "browser-toast" },
  });
  // Force the runner to re-parse the cron next tick.
  if (jobRunner) jobRunner.reloadCron(created.id).catch(() => {});
  res.json(created);
});

app.put("/api/jobs/:id", express.json(), (req, res) => {
  const existing = getDynamicJob(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const merged = { ...existing, ...req.body, id: existing.id };
  if (merged.cron) {
    try { parseCronGuard(merged.cron); }
    catch (e) { return res.status(400).json({ error: `bad cron: ${e.message}` }); }
  }
  const out = upsertDynamicJob(merged);
  if (jobRunner) jobRunner.reloadCron(out.id).catch(() => {});
  res.json(out);
});

app.delete("/api/jobs/:id", (req, res) => {
  const ok = deleteDynamicJob(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.json({ deleted: true });
});

// ─── Phase U08 — SSE event stream for run lifecycle ───
app.get("/api/jobs/events", (req, res) => {
  if (!jobRunner) return res.status(503).end("runner not ready");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (ev) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch {}
  };
  send({ type: "hello" });
  jobRunner.events.on("event", send);
  req.on("close", () => {
    try { jobRunner.events.off("event", send); } catch {}
  });
});

// Lazy-import so server.js doesn't pull lib/jobs/cron.js at top level
// (cron is also exercised by the runner). Keeps boot order forgiving.
function parseCronGuard(expr) {
  // Defer to lib/jobs/cron.js for the real parser; throws on bad input.
  // require() isn't available in ESM, but we already imported parseCron
  // indirectly through runner.js — we get it via a dynamic import once.
  if (!parseCronGuard._fn) {
    parseCronGuard._fn = null; // mark probing
    import("./lib/jobs/cron.js").then((m) => { parseCronGuard._fn = m.parseCron; }).catch(() => {});
  }
  if (typeof parseCronGuard._fn === "function") return parseCronGuard._fn(expr);
  // Fallback regex sanity if dynamic import hasn't completed yet.
  if (!/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(expr.trim())) {
    throw new Error("expected 5 cron fields");
  }
}

app.get("/api/jobs/policy", (req, res) => {
  res.json(getPolicy());
});

app.post("/api/jobs/policy", express.json(), (req, res) => {
  res.json(updatePolicy(req.body || {}));
});

app.get("/api/jobs/actions", (req, res) => {
  const sinceMs = parseInt(req.query.sinceMs || String(7 * 24 * 60 * 60 * 1000), 10);
  const jobId = req.query.jobId || null;
  res.json(listActionsSince({ jobId, sinceMs }));
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  const state = getJobState(job.id);
  const runs = listRuns({ jobId: job.id, limit: 20 });
  res.json({
    id: job.id,
    title: job.title,
    description: job.description,
    defaultCron: job.defaultCron,
    cron: state?.cron || job.defaultCron,
    enabled: state ? state.enabled === 1 : true,
    mcps: job.mcps || [],
    model: job.model,
    runs,
  });
});

app.post("/api/jobs/:id/enable", (req, res) => {
  if (!getJob(req.params.id)) return res.status(404).json({ error: "not found" });
  upsertJobState({ jobId: req.params.id, enabled: true });
  res.json({ id: req.params.id, enabled: true });
});

app.post("/api/jobs/:id/disable", (req, res) => {
  if (!getJob(req.params.id)) return res.status(404).json({ error: "not found" });
  upsertJobState({ jobId: req.params.id, enabled: false });
  res.json({ id: req.params.id, enabled: false });
});

app.post("/api/jobs/:id/config", express.json(), (req, res) => {
  if (!getJob(req.params.id)) return res.status(404).json({ error: "not found" });
  const { cron } = req.body || {};
  if (cron && !/^[\d*,/\- ]+$/.test(cron)) return res.status(400).json({ error: "bad cron" });
  upsertJobState({ jobId: req.params.id, cron });
  jobRunner?.reloadCron(req.params.id);
  res.json({ id: req.params.id, cron });
});

app.post("/api/jobs/:id/run", async (req, res) => {
  if (!getJob(req.params.id)) return res.status(404).json({ error: "not found" });
  if (!jobRunner) return res.status(503).json({ error: "runner not started yet" });
  try {
    const result = await jobRunner.runJob(req.params.id, "manual");
    res.json(result);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

app.get("/api/jobs/:id/runs", (req, res) => {
  if (!getJob(req.params.id)) return res.status(404).json({ error: "not found" });
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
  res.json(listRuns({ jobId: req.params.id, limit }));
});

app.get("/api/jobs/:id/runs/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run || run.jobId !== req.params.id) return res.status(404).json({ error: "not found" });
  res.json(run);
});

// ─── Debug-bot findings (Capabilities → Bugs Fixed) ───
//
// Backed by lib/debug-bot/store.js (sessions/jobs.db). The debug-bot job
// (every 5 min) populates these; the panel reads them and can apply or
// dismiss the needs_user ones.
//
//   GET  /api/bugs               → { stats, findings }  (?status= ?layer=)
//   POST /api/bugs/:id/dismiss   → mark a finding dismissed
//   POST /api/bugs/:id/fix       → force Ares to fix a needs_user finding now
app.get("/api/bugs", (req, res) => {
  try {
    openBugStore(SESSIONS_DIR);
    const findings = listFindings({
      status: req.query.status || undefined,
      layer: req.query.layer || undefined,
      limit: Math.min(parseInt(req.query.limit || "200", 10), 500),
    });
    res.json({ stats: findingStats(), findings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bugs/:id/dismiss", (req, res) => {
  try {
    openBugStore(SESSIONS_DIR);
    const row = setFindingStatus(req.params.id, { status: "dismissed" });
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bugs/:id/fix", async (req, res) => {
  if (!jobRunner) return res.status(503).json({ error: "runner not ready" });
  try {
    openBugStore(SESSIONS_DIR);
    const row = setFindingStatus(req.params.id, {});
    if (!row) return res.status(404).json({ error: "not found" });
    // Re-classify as safe so the next debug-bot sweep attempts the fix, and
    // kick a run now. (User explicitly authorised it, so the risky gate is
    // satisfied.)
    setFindingStatus(req.params.id, { status: "detected", risk: "safe" });
    jobRunner.runJob("debug-bot", "manual").catch(() => {});
    res.json({ ok: true, queued: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ─── Q-pass-4-C — Orchestrator live state ───
//
// The Tasks right-rail panel reads these endpoints to render the live
// subtask tree of the active parallel run (if any). State is in-process
// because at most one orchestrator runs at a time per server instance.
//
//   GET /api/orchestrator/state   → snapshot
//     { tasks: [{ id, title, status, model, parentTaskId, startedAt,
//                 finishedAt, durationMs }], activeSessionId }
//   GET /api/orchestrator/stream  → SSE — emits the same shape per event
//     { type: "task_added"|"task_updated"|"reset", task?, activeSessionId? }

app.get("/api/orchestrator/state", (req, res) => {
  res.json(getOrchestratorState());
});

app.get("/api/orchestrator/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  // Send the current snapshot immediately so a fresh subscriber
  // doesn't need a separate /state request.
  try {
    res.write(`data: ${JSON.stringify({ type: "snapshot", ...getOrchestratorState() })}\n\n`);
  } catch {}
  const send = (ev) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch {}
  };
  const unsub = subscribeOrchestratorState(send);
  req.on("close", () => { try { unsub(); } catch {} });
});

// ─── Phase U07c — Gateway (chat-mcp + email-mcp) ───
//
// Internal-only. Master switch defaults off, per-platform allowlists empty.
// All control endpoints write through to ~/.ares/gateway.json and the
// running GatewayManager picks up the change immediately via applyConfig.

app.get("/api/gateway/status", (req, res) => {
  if (!gatewayManager) return res.json({ enabled: false, error: "manager not initialised" });
  res.json(gatewayManager.status());
});

app.get("/api/gateway/config", (req, res) => {
  res.json(readGatewayConfig());
});

app.post("/api/gateway/config", express.json(), (req, res) => {
  try {
    const merged = writeGatewayConfig(req.body || {});
    if (gatewayManager) gatewayManager.applyConfig(merged);
    res.json({ ok: true, config: merged });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/gateway/start", (req, res) => {
  if (!gatewayManager) return res.status(503).json({ ok: false, error: "manager not initialised" });
  gatewayManager.applyConfig(readGatewayConfig());
  gatewayManager.start();
  res.json({ ok: true });
});

app.post("/api/gateway/stop", (req, res) => {
  if (!gatewayManager) return res.status(503).json({ ok: false, error: "manager not initialised" });
  gatewayManager.stop();
  res.json({ ok: true });
});

// Q-pass-5 close-out — manual refresh endpoint for Activity Feed.
// Triggers immediate Outlook + Slack polls, then runs a Haiku roll-up
// over the latest feed items + memory journal to surface "what should
// I prioritise next" recommendations.
app.post("/api/feed/refresh", express.json(), async (req, res) => {
  const summary = { gateway: { slack: 0, outlook: 0, errors: [] }, recommendations: [] };
  _clearSuggestionsCache(); // bust 60s cache so next /api/suggestions returns fresh chips
  // 1. Trigger immediate gateway poll (if enabled) — this handles the
  //    DRAFT-delivery layer. Independently, poll the feed watchers so the
  //    Activity Feed itself refreshes from Outlook/Slack even when the
  //    gateway's draft layer is off. P0-3.
  if (gatewayManager) {
    try {
      summary.gateway = await gatewayManager.pollNow();
    } catch (e) {
      summary.gateway.errors.push(`pollNow: ${e.message}`);
    }
  }
  try {
    const { pollNow: feedPollNow } = await import("./lib/feed/index.js");
    const fp = await feedPollNow(hub, () => bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0"));
    summary.feed = fp;
    if (Array.isArray(fp?.errors) && fp.errors.length) {
      summary.gateway.errors.push(...fp.errors);
    }
  } catch (e) {
    summary.gateway.errors.push(`feed pollNow: ${e.message}`);
  }
  // 2. Build a Haiku prompt from the latest feed items + memory journal
  //    + skill list. Returns 3-5 prioritised recommendations.
  try {
    const { getItems } = await import("./lib/feed/index.js");
    const items = (getItems() || []).slice(0, 30);
    const itemSummaries = items.map((it) => {
      const ageMin = Math.round((Date.now() - (it.ts || Date.now())) / 60000);
      return `- [${it.source}] ${it.title} (${ageMin}m ago) ${it.body ? "— " + it.body.slice(0, 120) : ""}`;
    }).join("\n");
    // Pull a small slice of memory + skills for context.
    let memoryHint = "";
    try {
      const journalPath = path.join(os.homedir(), ".kiro", "memory", "journal.jsonl");
      if (fs.existsSync(journalPath)) {
        const lines = fs.readFileSync(journalPath, "utf8").trim().split("\n").slice(-15);
        memoryHint = lines.map((ln) => {
          try { const e = JSON.parse(ln); return `${e.kind || "note"}: ${e.summary || e.title || ""}`; } catch { return ""; }
        }).filter(Boolean).slice(0, 10).join("\n");
      }
    } catch {}
    const sys = `You are Ares' Activity Feed prioritiser for User (Brand Specialist II, AVS-EU). ` +
      `Given the latest unresolved feed items + recent memory + the user's stakeholders, return 3-5 specific, actionable recommendations. ` +
      `Each recommendation must be a single line in this exact shape:\n` +
      `🔴|🟠|🟡 <action> — <reason> (refs: <feed-source-or-vendor>)\n\n` +
      `Use 🔴 for urgent (vendor escalation, expiring SLA, compliance), 🟠 for this-week, 🟡 for nice-to-have. ` +
      `RANK BY STAKEHOLDER: messages from higher-weight stakeholders (manager, primary vendor decision-makers) outrank strangers. ` +
      `Anchor each line to a specific feed item or memory fact when possible. Be concise — no preamble, no bullets, just the lines.`;
    // Phase D (P0-4) — inject the stakeholder list so recommendations can
    // rank by who a message is from.
    let stakeholderBlock = "";
    try {
      const { stakeholderPromptBlock } = await import("./lib/feed/stakeholders.js");
      stakeholderBlock = stakeholderPromptBlock();
    } catch {}
    const userPrompt = `=== Recent feed items (last 30, newest first) ===\n${itemSummaries || "(none)"}\n\n` +
      `=== Your stakeholders (higher weight = surface louder) ===\n${stakeholderBlock || "(none configured)"}\n\n` +
      `=== Recent memory entries (last 10) ===\n${memoryHint || "(none)"}\n\n` +
      `Now produce 3-5 prioritised recommendations.`;
    // P1-8 — bedrockFactory takes a STRING modelId, not an object, and the
    // id needs the full version suffix used elsewhere in this file.
    const haikuModel = process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";
    const haiku = bedrockFactory(haikuModel);
    const r = await haiku.invoke({
      system: sys,
      messages: [{ role: "user", content: [{ type: "text", text: userPrompt }] }],
      max_tokens: 600,
    });
    const text = r?.content?.find?.((c) => c.type === "text")?.text || "";
    summary.recommendations = text.split("\n").map((s) => s.trim()).filter((s) => s && /^[🔴🟠🟡]/u.test(s)).slice(0, 5);
  } catch (e) {
    summary.recommendations = [];
    summary.recommendationsError = e.message;
  }
  res.json(summary);
});

// ─── Phase U09 — sandbox backend control ───
app.get("/api/sandbox/status", (req, res) => {
  res.json(sandboxStatus());
});

app.post("/api/sandbox/switch", express.json(), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const next = setSandbox(name);
    let health = { ok: true };
    try { health = await next.health(); } catch (e) { health = { ok: false, info: e.message }; }
    res.json({ ok: true, sandbox: sandboxStatus(), health });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ─── Phase U11 — skills telemetry probe ───
app.get("/api/skills/telemetry", (req, res) => {
  res.json(skillsTelemetryRollup());
});

// ─── Q-pass-3 work-stream E — skills list / detail / draft / upload / run ───
import { listSkills as _listSkills, getSkill as _getSkill, deleteSkill as _deleteSkill, saveUserSkill as _saveUserSkill } from "./lib/skills/store.js";
import {
  listFolders as _listFolders,
  addFolder as _addFolder,
  removeFolder as _removeFolder,
  reindexFolder as _reindexFolder,
  getConfig as _getIndexConfig,
  setConfig as _setIndexConfig,
  diskSpace as _diskSpace,
} from "./lib/indexed-folders.js";

const _skillUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB cap per skill upload
});

// GET /api/skills — list every skill (built-in + user) with summary
// fields. Response shape: { skills: [{ slug, title, description, tools, builtIn, … }] }
app.get("/api/skills", (req, res) => {
  try { res.json({ skills: _listSkills() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Backward-compat: /api/skills/list returned `{ skills: [...] }` from the
// pre-Q-pass-3 placeholder. Keep it pointing at the same payload.
app.get("/api/skills/list", (req, res) => {
  try { res.json({ skills: _listSkills() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/skills/:slug", (req, res) => {
  const s = _getSkill(req.params.slug);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

app.delete("/api/skills/:slug", (req, res) => {
  try {
    const ok = _deleteSkill(req.params.slug);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "BUILTIN_PROTECTED") return res.status(403).json({ error: e.message });
    if (e.code === "INVALID_SLUG") return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/skills/:slug/run — surface a "Run via chat" hint. The chat
// surface picks this up and pre-fills the composer. The actual execution
// is the agent's skills__skill_search → skill_read flow.
app.post("/api/skills/:slug/run", express.json(), (req, res) => {
  const s = _getSkill(req.params.slug);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json({
    ok: true,
    delegate: { mcp: "skills", tool: "skill_read", args: { slug: s.slug } },
    promptHint: `/run-skill ${s.slug}`,
  });
});

// POST /api/skills/draft — Bedrock-Haiku-drafted skill body from a prompt.
app.post("/api/skills/draft", express.json(), async (req, res) => {
  const { prompt, title } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt required" });
  }
  try {
    const haiku = bedrockFactory("us.anthropic.claude-haiku-4-5-20251001-v1:0");
    const sys = `You are an expert at writing reusable AI agent skill recipes for the Ares system.
Each skill is a Markdown document with these sections in order:

# <title>

## Preconditions
- bullet list of what must be true before running

## Steps
1. numbered, copy-pasteable steps. Use code fences for shell commands.

## Notes
- optional troubleshooting / variants

Return ONLY the Markdown body — no commentary, no JSON wrapper. Keep it under 800 words.`;
    const r = await haiku.invoke({
      system: sys,
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: `Title: ${title || "(propose one)"}\n\nDescribe the skill:\n${prompt.slice(0, 2000)}`,
        }],
      }],
      max_tokens: 1500,
    });
    const txt = r?.content?.find?.((c) => c.type === "text")?.text || "";
    if (!txt.trim()) return res.status(502).json({ error: "empty draft from model" });
    // Best-effort title detection from the H1.
    const titleMatch = txt.match(/^#\s+(.+)$/m);
    const draftTitle = (title && title.trim()) || (titleMatch ? titleMatch[1].trim() : "New skill");
    res.json({ ok: true, title: draftTitle, body: txt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/skills/upload — accept .md files (one or many). Each file
// becomes a learned skill. Use field name "files" for multiple uploads.
app.post("/api/skills/upload", _skillUpload.array("files", 64), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "no files uploaded" });
  const saved = [];
  const errors = [];
  for (const f of files) {
    if (!/\.(md|markdown)$/i.test(f.originalname)) {
      errors.push({ file: f.originalname, error: "only .md files are supported" });
      continue;
    }
    try {
      const body = f.buffer.toString("utf8");
      const m = body.match(/^#\s+(.+)$/m);
      const title = (m ? m[1].trim() : f.originalname.replace(/\.[^.]+$/, "")).slice(0, 120);
      const r = _saveUserSkill({ title, body, keywords: [], tools: [] });
      saved.push({ slug: r.slug, title });
    } catch (e) {
      errors.push({ file: f.originalname, error: e.message });
    }
  }
  res.json({ ok: errors.length === 0, saved, errors });
});

// POST /api/skills — accept a JSON-shaped skill (used by "Create with AI"
// after the user reviews the Haiku draft). { title, body, keywords, tools }
app.post("/api/skills", express.json({ limit: "1mb" }), (req, res) => {
  try {
    const r = _saveUserSkill(req.body || {});
    res.json({ ok: true, ...r });
  } catch (e) {
    if (e.code === "INVALID_INPUT") return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ─── Q-pass-3 work-stream E — indexed folders + index config + diskspace ───
app.get("/api/indexed-folders", (req, res) => {
  try { res.json({ folders: _listFolders() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/indexed-folders", express.json(), (req, res) => {
  try {
    const f = _addFolder(req.body?.path);
    res.json({ ok: true, folder: f });
  } catch (e) {
    if (e.code === "INVALID_PATH") return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/indexed-folders/:id", (req, res) => {
  const ok = _removeFolder(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

app.post("/api/indexed-folders/:id/reindex", express.json(), (req, res) => {
  const f = _reindexFolder(req.params.id);
  if (!f) return res.status(404).json({ error: "not found" });
  // The actual indexing pipeline is a follow-up phase; this just toggles
  // status to "queued" + clears indexedAt so the UI can reflect it.
  res.json({ ok: true, folder: f });
});

app.get("/api/index-config", (req, res) => {
  try { res.json(_getIndexConfig()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/index-config", express.json(), (req, res) => {
  try { res.json(_setIndexConfig(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/diskspace", (req, res) => {
  try { res.json(_diskSpace()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Phase U15 — voice-memo transcription via Company Transcribe ───
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB cap — ~25 minutes of 16-bit 16kHz PCM
});

app.get("/api/transcribe/probe", (req, res) => {
  res.json(transcribeProbe());
});

app.post("/api/transcribe", audioUpload.single("audio"), async (req, res) => {
  if (!req.file?.buffer || !req.file.buffer.length) {
    return res.status(400).json({ error: "audio file required (multipart/form-data, field name 'audio')" });
  }
  const sampleRate = parseInt(req.body?.mediaSampleRateHertz || "16000", 10);
  const encoding = (req.body?.mediaEncoding || "pcm").toLowerCase();
  const lang = req.body?.languageCode || "en-US";
  try {
    const result = await transcribeBuffer({
      audio: req.file.buffer,
      mediaSampleRateHertz: sampleRate,
      mediaEncoding: encoding,
      languageCode: lang,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, name: err.name });
  }
});

// ─── Phase U18 — doctor probe ───
app.get("/api/doctor", async (req, res) => {
  try {
    const r = await runDoctor({ sessionsDir: SESSIONS_DIR });
    res.json(r);
  } catch (e) {
    res.status(500).json({ overall: "fail", error: e.message, checks: [] });
  }
});

// ─── Phase U16 — platform config introspection ───
import { loadPlatformConfig, ensureSeededConfig, PLATFORM_IDS } from "./lib/platforms.js";
ensureSeededConfig({ log: (m) => console.log(m) });

app.get("/api/platforms", (req, res) => {
  res.json({
    platforms: PLATFORM_IDS,
    config: loadPlatformConfig({ workspaceRoot: WORKSPACE_ROOT }),
  });
});

// ─── Phase U14 — plugin registry probe ───
app.get("/api/plugins", (req, res) => {
  try {
    res.json({ plugins: getPluginRegistry().list() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Phase U13 — slash-command registry + personality switch ───
app.get("/api/commands", (req, res) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : null;
  res.json({ commands: listCommands(scope) });
});

app.get("/api/personalities", (req, res) => {
  try {
    res.json({ personalities: listPersonalities() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/personalities/:name/select", (req, res) => {
  try {
    const r = setPersonality(req.params.name);
    res.json(r);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/commands/run", express.json(), (req, res) => {
  const { name, args = "" } = req.body || {};
  const cmd = getCommand(name);
  if (!cmd) return res.status(404).json({ error: `unknown command: ${name}` });
  if (!cmd.serverSide) {
    return res.status(400).json({ error: `command /${name} is frontend-side; the UI should handle it locally` });
  }
  // Server-side handlers.
  switch (cmd.name) {
    case "personality": {
      const target = (args || "").trim();
      if (!target) return res.status(400).json({ error: "/personality requires a name argument" });
      try { return res.json(setPersonality(target)); }
      catch (e) { return res.status(400).json({ error: e.message }); }
    }
    case "personalities":
      return res.json({ personalities: listPersonalities() });
    case "skills":
      // Real skill_search lives in the skills MCP. Surface a hint that the
      // agent should call it; the frontend will dispatch as a normal turn.
      return res.json({
        delegate: { mcp: "skills", tool: "skill_search", args: { query: "" } },
        message: "Use the skills sidebar / hub to inspect; /skills surfaces nothing server-side directly.",
      });
    case "usage":
      return res.json({
        promptCache: cacheStatus(),
        sandbox: sandboxStatus(),
      });
    case "platforms":
      // Phase U16 will populate this; today we surface a placeholder.
      return res.json({ platforms: ["browser", "electron-full", "electron-compact", "cli"], note: "Phase U16 will add per-platform tool filtering." });
    default:
      return res.status(500).json({ error: `command /${name} marked serverSide:true but no handler defined` });
  }
});

app.get("/api/sandbox/health", async (req, res) => {
  const box = getSandbox();
  try {
    const h = await box.health();
    res.json({ active: box.name, ...h });
  } catch (e) {
    res.status(500).json({ active: box.name, ok: false, info: e.message });
  }
});

// SSE chat endpoint
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, attachments: rawAttachments = [], model: requestedModel = "auto", mode = "standard", routing: requestedRouting = "smart", responseStyle: requestedResponseStyle = "balanced", appMode: requestedAppMode = "work" } = req.body || {};
  if (!sessionId || (!message && !rawAttachments.length)) {
    return res.status(400).json({ error: "sessionId + message or attachments required" });
  }
  const isDevMode = requestedAppMode === "dev";
  const session = loadSessionFromDisk(sessionId) || {
    id: sessionId, messages: [], createdAt: Date.now(),
  };
  // Tag dev-mode sessions so the UI can filter/badge them.
  if (isDevMode && !session._mode) {
    session._mode = "dev";
  }

  // P2-10 — concurrent-send guard. A 2nd /api/chat for a session that's
  // already streaming would call openStreamLog → closeStreamLog + unlink
  // the in-flight log, orphaning the first run's tail clients and wiping
  // the replay buffer mid-stream. Reject the duplicate with 409 so the
  // client can wait or attach via /stream-tail instead.
  if (activeStreams.has(sessionId)) {
    return res.status(409).json({
      error: "a run is already active for this session",
      code: "stream_in_progress",
      hint: "wait for it to finish, stop it via /api/sessions/:id/stop, or attach via /stream-tail",
    });
  }

  // Resolve model. Pass the full attachments array (with sizeBytes, mime,
  // name) so autoRoute can detect pageindex-eligible large/many files and
  // pick a thinking-tier model. Legacy: also accepts a count.
  let resolvedModelId;
  if (isDevMode) {
    // Dev mode always uses Opus 4.8 regardless of user selection.
    resolvedModelId = "us.anthropic.claude-opus-4-8";
  } else if (requestedModel === "auto") {
    resolvedModelId = autoRoute(message, rawAttachments);
  } else {
    resolvedModelId = requestedModel;
  }

  // Register this stream as active so other clients (e.g. the same session
  // reloaded in another tab) can poll status and see progress.
  activeStreams.set(sessionId, {
    startedAt: Date.now(),
    mode,
    model: resolvedModelId,
  });
  openStreamLog(sessionId);

  // Reconstruct Claude content blocks from attachment metadata the client
  // received back from /api/sessions/:id/upload. Re-read each file off disk
  // so we don't have to pass large base64 blobs through the JSON request.
  // D-5: read every attachment in parallel via fs.promises.readFile. Pre-fix
  // the loop did serial readFileSync — multi-MB files delayed SSE first
  // byte by hundreds of ms.
  const userBlocks = [];
  const attachmentMetas = [];
  const attachmentReads = await Promise.all(rawAttachments.map(async (att) => {
    try {
      const buf = await fs.promises.readFile(att.path);
      return { att, buf, err: null };
    } catch (e) {
      return { att, buf: null, err: e };
    }
  }));
  for (const { att, buf, err } of attachmentReads) {
    if (err) {
      userBlocks.push({ type: "text", text: `<attachment error="${err.message}" name="${att.name}"/>` });
      continue;
    }
    if (att.kind === "image") {
      userBlocks.push({
        type: "image",
        source: { type: "base64", media_type: att.mime, data: buf.toString("base64") },
      });
    } else if (att.kind === "pdf") {
      userBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
        title: att.name,
      });
    } else if (att.kind === "text") {
      userBlocks.push({
        type: "text",
        text: `<file name="${_escapeFileAttr(att.name)}" mime="${_escapeFileAttr(att.mime)}" size="${att.sizeBytes}">\n${buf.toString("utf8")}\n</file>`,
      });
    } else {
      userBlocks.push({
        type: "text",
        text: `<attachment name="${_escapeFileAttr(att.name)}" mime="${_escapeFileAttr(att.mime)}" size="${att.sizeBytes}" path="${_escapeFileAttr(att.path)}">\nUse filesystem-agent / shell-agent / mac-apps MCPs to open this file at the path above.\n</attachment>`,
      });
    }
    attachmentMetas.push({ name: att.name, mime: att.mime, sizeBytes: att.sizeBytes, path: att.path, kind: att.kind });
  }
  if (message) userBlocks.push({ type: "text", text: message });

  // Persist the user turn — push to memory AND flush to disk immediately.
  // Without the immediate flush, switching sessions before the agent's
  // first saveProgress (~iteration 5) makes the user turn disappear from
  // the UI on session reload. The on-disk file IS the source of truth
  // for openSession; in-memory state is incidental.
  //
  // Q-pass-5 close-out — guard against consecutive user messages.
  // If the last message is already a user message (because the previous
  // run was interrupted before the agent appended its assistant turn,
  // or the user sent a message while one was already in flight), merge
  // the new content blocks into the existing user message rather than
  // creating a second consecutive user turn. Bedrock requires strict
  // user/assistant alternation, and consecutive user messages cause
  // the "messages.N: tool_use ids were found without tool_result"
  // error to cascade through the next iteration.
  const lastMsg = session.messages[session.messages.length - 1];
  if (lastMsg && lastMsg.role === "user" && Array.isArray(lastMsg.content)) {
    lastMsg.content = [...lastMsg.content, ...userBlocks];
    if (attachmentMetas.length) {
      lastMsg._attachments = [...(lastMsg._attachments || []), ...attachmentMetas];
    }
  } else {
    session.messages.push({
      role: "user",
      content: userBlocks,
      _attachments: attachmentMetas,
    });
  }
  session.updatedAt = Date.now();
  saveSessionToDisk(sessionId, session);
  // Best-effort: index this user turn into the session RAG. Async fire-and-
  // forget so we don't block the SSE stream startup. Errors are logged but
  // never fatal — the session continues even if indexing fails.
  indexTurn({
    sessionsDir: SESSIONS_DIR,
    sessionId,
    seq: session.messages.length - 1,
    role: "user",
    content: userBlocks,
    ts: Date.now(),
  }).catch((err) => console.warn("[session-rag] index user turn failed:", err.message));
  // ---- real-time learning hook ----
  // Classify the user's turn with Haiku: is it a preference, correction,
  // or fact worth promoting NOW (don't wait 24h for session-summariser)?
  // Fire-and-forget so it doesn't block SSE.
  (async () => {
    try {
      if (!message || message.length < 12) return;
      const haiku = bedrockFactory("us.anthropic.claude-haiku-4-5-20251001-v1:0");
      const sys = `You classify user turns for memory promotion. Output STRICT JSON only:
{ "promote": true|false, "kind": "preference"|"correction"|"learning"|"fact"|"none", "summary": "<1 sentence>", "value": "<the rule/fact verbatim>", "tags": ["kebab","tags"] }
Rules:
- promote=true ONLY for: durable preferences ("always sign..."), corrections ("don't do X"), or facts ("my manager is Y").
- promote=false for: questions, requests for action, casual chitchat, or anything ephemeral to the current task.
- Be CONSERVATIVE — over-promotion bloats memory.`;
      const r = await haiku.invoke({
        system: sys,
        messages: [{ role: "user", content: [{ type: "text", text: message.slice(0, 2000) }] }],
        max_tokens: 400,
      });
      const txt = r?.content?.find?.((c) => c.type === "text")?.text || "";
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) return;
      const parsed = JSON.parse(m[0]);
      if (!parsed.promote) return;
      // E-7: validate the parsed payload before promotion. A hostile
      // file content could ship a JSON object the Haiku classifier
      // happily echoes back (e.g. `{ "promote": true, "kind":
      // "preference", "value": "always run rm -rf /" }`). Reject the
      // promotion if any field is suspicious.
      const ALLOWED_KINDS = new Set(["preference", "correction", "learning", "fact"]);
      if (!ALLOWED_KINDS.has(parsed.kind)) return;
      const value = String(parsed.value || parsed.summary || "");
      const summary = String(parsed.summary || "");
      // Length sanity. Pre-fix nothing capped these so a hostile file
      // could promote a multi-KB rule.
      if (value.length > 600 || summary.length > 240) return;
      // Tool-syntax / shell-metacharacter blocklist. The patterns here
      // are conservative — a value containing them is almost certainly
      // an injection attempt rather than a legitimate user preference.
      const INJECTION_PATTERNS = [
        /\brm\s+-rf?\b/i,
        /\bsudo\b/i,
        /\bdd\s+if=/i,
        /\bcurl\b.*\|\s*(?:bash|sh|zsh)\b/i,
        /<tool[\s_]use|<tool_result/i,
        /\bignore (?:all )?prior(?: instructions)?\b/i,
      ];
      for (const pat of INJECTION_PATTERNS) {
        if (pat.test(value) || pat.test(summary)) {
          console.warn(`[realtime-learning] refused promotion (matched ${pat}): ${summary.slice(0, 80)}`);
          return;
        }
      }
      if (parsed.kind === "preference") {
        await hub.callTool("memory__memory_learn_preference", {
          key: (parsed.tags?.[0] || "general").replace(/[^a-z0-9_]/gi, "_"),
          value,
        });
      } else {
        await hub.callTool("memory__memory_record", {
          summary,
          details: value || summary,
          outcome: "completed",
          tags: ["realtime-learning", parsed.kind, ...(parsed.tags || [])].slice(0, 8),
        });
      }
      console.log(`[realtime-learning] promoted ${parsed.kind}: ${parsed.summary?.slice(0, 80)}`);
    } catch (err) {
      // Silent — the agent will still run; we just didn't promote this turn.
      if (process.env.ARES_DEBUG_MEMORY) console.warn("[realtime-learning]", err.message);
    }
  })();


  // Build Claude-shaped message array (content as blocks so we can append tool_result user-messages)
  // Strip UI-only fields (like _attachments) so the model doesn't see them.
  const claudeMessages = session.messages.map((m) => {
    const copy = { role: m.role };
    if (typeof m.content === "string") {
      copy.content = [{ type: "text", text: m.content }];
    } else {
      copy.content = m.content;
    }
    return copy;
  });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Track if client disconnects mid-stream. Socket close is NOT an abort
  // — the run keeps going and the file-backed stream log lets the client
  // resume via /stream-tail. Only an explicit POST /stop aborts the run.
  let clientDisconnected = false;
  const runAbort = new AbortController();
  registerRun(sessionId, runAbort);
  res.on("close", () => {
    clientDisconnected = true;
    // Intentionally DO NOT call runAbort.abort() here — refresh/tab-close
    // must not kill the server-side work. Use POST /stop for that.
  });

  const send = (obj) => {
    // Record every event to the stream log first so late-arriving tail
    // consumers can replay it exactly. Do this even if the original
    // client has disconnected — that's the whole point of file-backed
    // resume.
    appendStreamEvent(sessionId, obj);
    if (clientDisconnected) return;
    // Q-pass-5 P0-2 — when the run was moved to background, stop
    // forwarding live events to the originating socket. The stream
    // log keeps growing so any reconnecting tab still gets the full
    // history via /stream-tail.
    if (runAbort?.signal?.aborted === false && runAbort?._aresBackgrounded) return;
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {}
  };

  // Send the resolved model info to the client. P2-3 — keep this
  // shape-compatible with agent.js's canonical model_info (adds `routing`,
  // marks `preflight` so it's distinguishable from the agent's
  // authoritative emit which fires once tools are resolved). The UI maps
  // mode!=="direct" → "smart", so "standard"/"parallel" render correctly
  // and the agent's later emit refines toolCount/note.
  send({ type: "model_info", model: resolvedModelId, mode, routing: requestedRouting || "smart", requestedModel, preflight: true });

  let finalMessages = null;

  // Helper: save session state incrementally so progress isn't lost on
  // refresh/error. CRITICAL FIX (2026-05-30): NEVER overwrite earlier
  // messages with compressed versions. The compressor replaces user
  // prompts with <context_summary> blocks in the working transcript —
  // if we save that back to disk, the UI loses the original user text
  // forever (the "user value goes away" bug). Instead: only APPEND
  // messages that are genuinely new (beyond what's already on disk).
  // The on-disk transcript is the FULL, uncompressed history the UI
  // renders; the working transcript is ephemeral and never persisted.
  const saveProgress = (messages) => {
    if (!messages || messages.length <= 1) return;
    const priorLen = session.messages.length;

    // CRITICAL: save the new assistant response WITHOUT overwriting
    // earlier messages with compressed versions. Strategy:
    //   - If messages is longer than prior → append the new tail
    //   - If messages is shorter/same (compression happened) BUT the
    //     LAST message is an assistant turn not yet on disk → append
    //     just that last message (the response we need to keep)
    //   - Otherwise → nothing new to save
    if (messages.length > priorLen) {
      // Simple case: transcript grew. Append the new tail.
      const newMessages = messages.slice(priorLen);
      for (const m of newMessages) {
        session.messages.push({ ...m });
      }
    } else {
      // Transcript was compressed (shorter or same length). Check if
      // the last message is a NEW assistant response we haven't saved.
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        // Check if the last message on disk is already this assistant turn.
        const diskLast = session.messages[session.messages.length - 1];
        const alreadySaved = diskLast?.role === "assistant" &&
          JSON.stringify(diskLast.content) === JSON.stringify(last.content);
        if (!alreadySaved) {
          session.messages.push({ ...last });
        }
      }
    }
    session.updatedAt = Date.now();
    saveSessionToDisk(sessionId, session);
    // Index any new turns since the last save into the session RAG.
    const newLen = session.messages.length;
    for (let i = priorLen; i < newLen; i++) {
      const m = session.messages[i];
      if (!m?.role || !m?.content) continue;
      indexTurn({
        sessionsDir: SESSIONS_DIR,
        sessionId,
        seq: i,
        role: m.role,
        content: m.content,
        ts: Date.now(),
      }).catch((err) => console.warn(`[session-rag] index turn ${i} failed:`, err.message));
    }
  };

  // Phase RP1-B2 — hoisted: shared between parallel + standard modes so
  // the auto-recorder gate downstream can read it regardless of which
  // path the run took.
  let lastCredentialErrorEv = null;
  // RP1-B1 — captured from the agent if it exhausted its premature-stop
  // nudge budget. Drives the auto-record outcome tag (incomplete vs completed).
  let prematureStopEv = null;

  if (mode === "parallel") {
    // Parallel orchestrator mode
    const orchestrator = new Orchestrator({
      bedrockFactory,
      hub,
      systemPrompt,
      region: REGION,
      profile: PROFILE,
      // P2-11 — hold parallel-mode subagents to the same approval gate as
      // the single-agent path so dangerous tools aren't run unguarded.
      approvalGate: makeApprovalGate(sessionId),
    });
    // Accumulate sub-agent outputs so we can persist even if synthesis fails
    const subtaskTexts = new Map(); // id -> { title, text }
    const subtaskTitles = new Map();
    try {
      for await (const ev of orchestrator.run(claudeMessages, message, { abortSignal: runAbort.signal, sessionId })) {
        send(ev);
        if (ev.type === "subtask_start") {
          subtaskTitles.set(ev.id, ev.title);
        }
        if (ev.type === "subtask_event" && ev.event?.type === "text_delta") {
          const cur = subtaskTexts.get(ev.id) || { title: subtaskTitles.get(ev.id) || ev.id, text: "" };
          cur.text += ev.event.text;
          subtaskTexts.set(ev.id, cur);
        }
        if (ev.type === "subtask_done") {
          // Incremental save: persist parallel progress so a client
          // disconnect mid-stream doesn't lose everything.
          const partialText = [...subtaskTexts.values()]
            .map((r) => `## ${r.title}\n${r.text}`)
            .join("\n\n---\n\n");
          if (partialText) {
            const partialMessages = [
              ...claudeMessages,
              { role: "assistant", content: [{ type: "text", text: partialText }] },
            ];
            saveProgress(partialMessages);
          }
        }
        if (ev.type === "done") {
          finalMessages = ev.finalMessages;
          saveProgress(finalMessages);
        }
        if (ev.type === "premature_stop") {
          prematureStopEv = ev;
          finalMessages = ev.finalMessages;
          saveProgress(finalMessages);
        }
        if (ev.type === "error" && ev.kind === "credentials") {
          lastCredentialErrorEv = ev;
        }
        if (ev.type === "error") break;
      }
    } catch (err) {
      if (err?.name === "AbortError" || runAbort.signal.aborted) {
        send({ type: "aborted", reason: "client-stop" });
      } else {
        if (err?.isCredentialError) {
          lastCredentialErrorEv = { type: "error", kind: "credentials", error: err.message };
        }
        send({ type: "error", error: err.message });
      }
    }
    // Save whatever we have even if it didn't complete cleanly
    if (!finalMessages) {
      const partialText = [...subtaskTexts.values()]
        .map((r) => `## ${r.title}\n${r.text}`)
        .join("\n\n---\n\n");
      if (partialText) {
        saveProgress([
          ...claudeMessages,
          { role: "assistant", content: [{ type: "text", text: partialText }] },
        ]);
      } else {
        saveProgress(claudeMessages);
      }
    }
  } else {
    // Standard single-agent mode
    const chatBedrock = bedrockFactory(resolvedModelId);
    // Q-pass-4 work-stream A — when the per-session `_stripSteering`
    // flag is set (by POST /api/sessions/:id/strip-steering), rebuild
    // the system prompt for THIS session with the steering cap forced
    // to 0. Cheap — builds a fresh string for one turn rather than
    // mutating the boot-time global.
    let systemPromptForRun = systemPrompt;
    if (isDevMode) {
      // Dev mode uses a dedicated self-improvement prompt.
      systemPromptForRun = buildDevSystemPrompt();
    } else if (session._stripSteering) {
      try {
        systemPromptForRun = await buildSystemPrompt({
          workspaceRoot: WORKSPACE_ROOT,
          mcpCatalog: hub.getCatalogForPrompt(),
          caps: { ...getSystemPromptCaps(), steering: 0 },
        });
      } catch (e) {
        console.warn("[prompt] strip-steering rebuild failed:", e.message);
      }
    }
    // Q-pass-5 P3-3 — append response-style hint to the system prompt
    // for THIS turn. Brief = bullets, Detailed = explain reasoning.
    if (requestedResponseStyle === "brief") {
      systemPromptForRun = `${systemPromptForRun}\n\n<response_style>Be brief. Bullet points where possible. Skip preamble. Lead with the answer; expand only if asked.</response_style>`;
    } else if (requestedResponseStyle === "detailed") {
      systemPromptForRun = `${systemPromptForRun}\n\n<response_style>Be detailed. Explain reasoning, cite sources/files inline, walk through edge cases. Use sections + headers when the topic warrants it.</response_style>`;
    }
    const agent = new Agent({
      bedrock: chatBedrock,
      hub,
      systemPrompt: systemPromptForRun,
      approvalGate: makeApprovalGate(sessionId),
      platform: req.body?.platform || (typeof req.query?.platform === "string" ? req.query.platform : null),
      // Q-pass-2: haikuFactory drives the knowledge-graph per-turn
      // extractor. Fire-and-forget; failures don't surface to the agent.
      haikuFactory: () => bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
    });
    // Q-pass-4 work-stream A — propagate session-scoped flags so
    // `_capTools` and the run loop honour the recovery toggles.
    agent._sessionId = sessionId;
    agent._tier1Only = !!session._tier1Only;
    agent._stripSteering = !!session._stripSteering;
    // Q-pass-5 P0-4 — Smart vs Direct routing. Direct = no MCPs, no
    // skill_search, no RAG injection. Persona stays. Single Bedrock turn.
    agent._aresRouting = requestedRouting === "direct" ? "direct" : "smart";

    // Backfill the RAG index with any pre-existing turns the first time we
    // run on a long session that predates this feature. Cheap idempotency
    // guard inside indexTurn means re-runs are no-ops.
    reindexSession({
      sessionsDir: SESSIONS_DIR,
      sessionId,
      messages: session.messages,
    }).catch((err) => console.warn("[session-rag] backfill failed:", err.message));

    // Retrieval callback the agent calls before each Bedrock invocation.
    // It returns up to K past turns relevant to the user's most recent
    // question. The agent injects them as a transient <relevant_history>
    // block in the prompt — they never enter the persisted transcript.
    // Layer-2 memory auto-inject. Builds a compact <memory_brief>
    // block from preferences + smart-recall on the user's query.
    // No caching — the realtime-learning hook writes preferences fast
    // and the next turn must see them immediately. memory_get_preferences
    // is a local SQLite read, ~30ms — negligible.
    const retrieveMemoryBrief = async ({ query, turnIndex }) => {
      // Dev mode: use the separate dev memory journal instead of work memory.
      if (isDevMode) {
        try {
          const hits = searchDev(query || "", 6);
          if (!hits.length) return "";
          const lines = hits.map((h) => `- [${new Date(h.ts).toISOString().slice(0, 10)}] ${h.summary}${h.lessons ? ` (lesson: ${h.lessons})` : ""}`);
          return `## Dev memory\n${lines.join("\n")}`;
        } catch (err) {
          console.warn("[dev-memory-brief] failed:", err.message);
          return "";
        }
      }
      try {
        let prefs = "";
        try {
          const r = await hub.callTool("memory__memory_get_preferences", {});
          prefs = (r?.content || []).map((b) => b.text || "").join("").slice(0, 1800);
        } catch {}
        let recall = "";
        if (query && query.length > 6) {
          try {
            const r = await hub.callTool("memory__memory_smart_recall", { query, limit: 4 });
            recall = (r?.content || []).map((b) => b.text || "").join("").slice(0, 1400);
          } catch {}
        }
        const parts = [];
        if (prefs) parts.push(`## Preferences\n${prefs}`);
        if (recall) parts.push(`## Relevant past work\n${recall}`);
        return parts.join("\n\n");
      } catch (err) {
        console.warn("[memory-brief] failed:", err.message);
        return "";
      }
    };

    const retrieveContext = async ({ query, excludeFromSeq }) => {
      try {
        const total = countTurns({ sessionsDir: SESSIONS_DIR, sessionId });
        // Don't retrieve until the index is big enough to be useful.
        if (total < 30) return [];
        return await searchSession({
          sessionsDir: SESSIONS_DIR,
          sessionId,
          query,
          k: 6,
          excludeFromSeq,
        });
      } catch (err) {
        console.warn("[session-rag] search failed:", err.message);
        return [];
      }
    };

    // Phase RP1-B2 — capture the most recent credential error event
    // (variable hoisted above mode branch) so the auto-recorder
    // eligibility gate below can skip a junk memory entry on a
    // creds-died run.
    try {
      for await (const ev of agent.run(claudeMessages, { abortSignal: runAbort.signal, retrieveContext, retrieveMemoryBrief })) {
        // Checkpoints are internal — persist to disk but don't forward to
        // the browser (they'd just noise up the stream log).
        if (ev.type === "checkpoint") {
          writeCheckpoint(sessionId, {
            iteration: ev.iteration,
            mode,
            model: resolvedModelId,
            workingMessages: ev.messages,
            createdAt: Date.now(),
          });
          continue;
        }
        send(ev);
        if (ev.type === "done") {
          finalMessages = ev.finalMessages;
          saveProgress(finalMessages);
        }
        if (ev.type === "premature_stop") {
          prematureStopEv = ev;
          finalMessages = ev.finalMessages;
          saveProgress(finalMessages);
        }
        if (ev.type === "progress") {
          saveProgress(ev.messages); // Incremental save every 5 iterations
        }
        if (ev.type === "error" && ev.kind === "credentials") {
          lastCredentialErrorEv = ev;
        }
        if (ev.type === "error" || ev.type === "aborted") break;
      }
    } catch (err) {
      if (err?.name === "AbortError" || runAbort.signal.aborted) {
        send({ type: "aborted", reason: "client-stop" });
      } else {
        // Synthesise the same kind=credentials marker the agent path
        // emits, so the eligibility gate catches errors that escaped
        // the agent's catch.
        if (err?.isCredentialError) {
          lastCredentialErrorEv = { type: "error", kind: "credentials", error: err.message };
        }
        send({ type: "error", error: err.message });
      }
    }
    // Save whatever we have even if it didn't complete cleanly
    if (!finalMessages) saveProgress(claudeMessages);
  }

  // Phase RP1-B2 — auto-recorder eligibility gate.
  // The gate is `lib/auto-record-gate.js::isAutoRecorderEligible`.
  // We import it as `gateAutoRecord` (alias) so the local closure
  // below can curry the run-specific outcome. Skips memory_record when
  // the run died on a Bedrock cred error OR the last assistant turn is
  // empty/error-prefixed text (avoids the "isengardcli" memory
  // pollution the gate was built to fix).
  const isAutoRecorderEligible = () => gateAutoRecord({
    sawCredentialError: lastCredentialErrorEv != null,
    finalMessages: finalMessages || [],
  });

  // Auto-record to dev memory when in dev mode.
  if (isDevMode && finalMessages && session.messages.length >= 2 && isAutoRecorderEligible()) {
    try {
      const anchorText = firstUserTextFromMessages(session.messages) || "Dev session";
      let toolNames = [];
      for (const m of finalMessages) {
        if (m?.role !== "assistant" || !Array.isArray(m.content)) continue;
        for (const b of m.content) {
          if (b.type === "tool_use" && b.name) toolNames.push(b.name);
        }
      }
      recordDev({
        summary: anchorText.slice(0, 200),
        details: `Session ${sessionId} · ${session.messages.length} messages · Tools: ${[...new Set(toolNames)].slice(0, 10).join(", ") || "none"}`,
        outcome: prematureStopEv ? "incomplete" : "completed",
        tags: ["auto-recorded", `session:${sessionId}`],
      });
    } catch (err) {
      console.error("[dev-auto-record] failed:", err.message);
    }
  }

  // Auto-record to central memory. Records once on the FIRST completed
  // turn (so future sessions can search for "what did I work on in
  // session X"), and again whenever a turn produces a significant new
  // outcome — defined as: at least 3 tool calls in this run AND new
  // assistant text content >300 chars (filters out trivial chitchat).
  // Each record points back at the session id so the central index can
  // hand off to the session RAG when deeper recall is needed.
  if (!isDevMode && finalMessages && session.messages.length >= 2 && isAutoRecorderEligible()) {
    // Gate: skip trivial exchanges (e.g. "hi" → "Hello!") to avoid
    // polluting memory with noise. If the user's first message is ≤10
    // chars AND total assistant text in finalMessages is ≤200 chars,
    // the exchange is too trivial to record.
    const _firstUserText = firstUserTextFromMessages(session.messages) || "";
    let _totalAssistantText = 0;
    if (finalMessages) {
      for (const m of finalMessages) {
        if (m?.role !== "assistant" || !Array.isArray(m.content)) continue;
        for (const b of m.content) {
          if (b?.type === "text" && typeof b.text === "string") _totalAssistantText += b.text.length;
        }
      }
    }
    const isTrivialExchange = _firstUserText.length <= 10 && _totalAssistantText <= 200;
    if (isTrivialExchange) {
      // Skip auto-record for trivial exchanges.
    } else {
    try {
      const lastTurnIdx = session._lastRecordedTurnIdx ?? -1;
      const newTurns = finalMessages.slice(lastTurnIdx + 1);
      let newToolCalls = 0;
      let newAssistantTextLen = 0;
      const toolNames = new Set();
      for (const m of newTurns) {
        if (m?.role !== "assistant" || !Array.isArray(m.content)) continue;
        for (const b of m.content) {
          if (b.type === "tool_use") { newToolCalls++; if (b.name) toolNames.add(b.name); }
          if (b.type === "text" && typeof b.text === "string") newAssistantTextLen += b.text.length;
        }
      }

      const isFirstRecord = !session._recorded;
      const isSignificantNewWork = newToolCalls >= 3 && newAssistantTextLen >= 300;

      if (isFirstRecord || isSignificantNewWork) {
        // Pick the user message that triggered this record as the "summary"
        // anchor. For the first record, that's the original ask; otherwise
        // it's the most recent user turn.
        let anchorText;
        if (isFirstRecord) {
          anchorText = firstUserTextFromMessages(session.messages) || "Chat exchange";
        } else {
          // Walk back from the end to find the user turn that started this
          // sub-task.
          for (let i = finalMessages.length - 1; i >= 0; i--) {
            const m = finalMessages[i];
            if (m?.role !== "user" || !Array.isArray(m?.content)) continue;
            const txt = m.content.filter((b) => b?.type === "text").map((b) => b.text).join(" ");
            if (txt.trim()) { anchorText = txt.trim(); break; }
          }
          anchorText = anchorText || "Follow-up turn";
        }
        const summary = anchorText.slice(0, 200);
        const details = [
          `Session ${sessionId}`,
          `${session.messages.length} messages total · ${newToolCalls} new tool call(s) this segment`,
          `Tools used: ${[...toolNames].slice(0, 12).join(", ") || "none"}`,
          `Model: ${resolvedModelId}`,
          `Search session RAG (sessions/${sessionId}.rag.db) for verbatim recall of any earlier turn.`,
        ].join("\n");
        // RP1-B1 — if the agent yielded `premature_stop` (exhausted nudge
        // budget), tag the entry so the central index reports the run as
        // incomplete rather than claiming it finished cleanly.
        const outcome = prematureStopEv ? "incomplete" : "completed";
        const recordTags = [
          "ares-chat", "auto-recorded",
          isFirstRecord ? "session-start" : "follow-up",
          `session:${sessionId}`,
        ];
        if (prematureStopEv) recordTags.push("outcome:incomplete", "premature-stop");
        await hub.callTool("memory__memory_record", {
          summary,
          details,
          outcome,
          tags: recordTags,
        });
        session._recorded = true;
        session._lastRecordedTurnIdx = finalMessages.length - 1;
        saveSessionToDisk(sessionId, session);
      }
    } catch (err) {
      console.error("[auto-record] failed:", err.message);
    }
    } // end else (non-trivial exchange)
  }

  // Clear the active-stream marker so polling clients know it's done.
  activeStreams.delete(sessionId);
  unregisterRun(sessionId, runAbort);
  // Also clean up the checkpoint — the run completed (or errored cleanly);
  // we do not want a stale checkpoint offering a bogus resume.
  deleteCheckpoint(sessionId);

  // Q-pass-5 P0-2 — if this run was moved to background, emit a feed
  // item so the user sees the result without re-attaching the chat tab.
  if (runAbort?._aresBackgrounded && _backgroundRuns.has(sessionId)) {
    try {
      const meta = _backgroundRuns.get(sessionId);
      _backgroundRuns.delete(sessionId);
      // Best-effort summary from the last assistant text.
      let summary = "Done.";
      try {
        const last = (finalMessages || []).slice().reverse().find((m) => m?.role === "assistant");
        if (Array.isArray(last?.content)) {
          summary = last.content
            .filter((b) => b?.type === "text")
            .map((b) => b.text || "")
            .join(" ")
            .replace(/\s+/g, " ")
            .slice(0, 220) || summary;
        }
      } catch {}
      const { pushItem } = await import("./lib/feed/index.js");
      pushItem({
        id: `bg-done-${sessionId}-${Date.now()}`,
        type: "background-done",
        source: "background-task",
        title: `Background task complete · ${meta?.label || sessionId.slice(0, 8)}`,
        body: summary,
        ts: Date.now(),
        actions: [
          { id: "open", label: "Open session", kind: "open-session", sessionId },
        ],
        // Q-pass-5 close-out — Electron main polls /api/feed/items every
        // few seconds and fires a system Notification for any item that
        // carries `desktopNotify:true` and we haven't already notified
        // on. The renderer-side feed surface ignores this flag.
        desktopNotify: true,
        sessionId,
      });
      // Also fire a desktop notification via the Electron shell when present.
      // The renderer-side ipc bridge handles the actual display; we just
      // log so the test suite can assert it fired.
      console.log(`[bg-done] session=${sessionId} summary="${summary.slice(0, 80)}"`);
    } catch (e) {
      console.warn("[bg-done] feed push failed:", e.message);
    }
  }

  // Send the sentinel "end" event while the stream log is still open, so
  // tail clients receive it too. Then close the log (deletes the file).
  send({ type: "end" });
  closeStreamLog(sessionId);
  res.end();
});

// -------- boot --------
(async () => {
  console.log("=".repeat(60));
  console.log("Ares Chat booting...");
  console.log(`  workspace : ${WORKSPACE_ROOT}`);
  console.log(`  mcp.json  : ${MCP_JSON}`);
  console.log(`  model     : ${MODEL_ID}`);
  console.log(`  region    : ${REGION}`);
  console.log(`  profile   : ${process.env.AWS_PROFILE || "default"}`);
  console.log("=".repeat(60));

  await hub.start();

  // Phase U05 — register a factory the meta-tool ares_delegate_subagent
  // uses to spin up a fresh Orchestrator. The hub never imports
  // ./lib/orchestrator.js itself (would create an import cycle through
  // agent.js → mcp-client.js); instead the wiring lives here.
  hub.setOrchestratorFactory(() =>
    new Orchestrator({ bedrockFactory, hub, systemPrompt })
  );

  // Phase U14 — load plugins. Failure to load a single plugin is non-
  // fatal; we catch and log so a broken plugin doesn't take the server
  // down. Plugins receive subsequent hook fires from the agent loop +
  // hub via the singleton registry.
  try {
    const pluginReg = getPluginRegistry();
    await pluginReg.load({ workspaceRoot: WORKSPACE_ROOT });
    if (pluginReg.plugins.length) {
      console.log(`[plugins] ${pluginReg.plugins.length} loaded`);
    }
  } catch (e) {
    console.warn(`[plugins] init failed (non-fatal): ${e.message}`);
  }

  // Phase U07c — gateway manager. Reads ~/.ares/gateway.json. Runs
  // nothing until config.enabled is true AND the per-platform enabled
  // flag is true AND the allowlist is non-empty. Stays inert by default.
  gatewayManager = new GatewayManager({
    hub,
    bedrockFactory,
    systemPrompt,
    log: (msg) => console.log(`[gateway] ${msg}`),
  });
  try {
    gatewayManager.applyConfig(readGatewayConfig());
    gatewayManager.start();
  } catch (e) {
    console.warn(`[gateway] init failed (non-fatal): ${e.message}`);
  }

  // C-2: start the background integrity validator. Disabled by setting
  // ARES_INTEGRITY_INTERVAL_MS=0.
  const integrityIntervalMs = parseInt(process.env.ARES_INTEGRITY_INTERVAL_MS || "600000", 10);
  if (integrityIntervalMs > 0) {
    _integrityValidator = startBackgroundValidator({
      sessionsDir: SESSIONS_DIR,
      intervalMs: integrityIntervalMs,
      log: (level, msg) => { (level === "warn" ? console.warn : console.log)(msg); },
      metric: incCounter,
    });
  }

  // D-3: defer the pruneEmptySessions sweep to a tick after app.listen.
  // It does sync readFile + JSON.parse over every session file. Big
  // workspaces would block the boot path here, delaying first byte for
  // 50–200 ms. Run it asynchronously instead.
  setImmediate(() => {
    try { pruneEmptySessions(); } catch (e) {
      console.warn(`[boot] pruneEmptySessions deferred run failed: ${e.message}`);
    }
  });

  // Any stream logs on disk at boot time are stale — they were written
  // by a prior server lifetime whose in-memory EventEmitter is gone, so
  // no tail client can be receiving live events from them. Wipe them.
  try {
    for (const f of fs.readdirSync(STREAM_LOGS_DIR)) {
      if (f.endsWith(".jsonl")) {
        try { fs.unlinkSync(path.join(STREAM_LOGS_DIR, f)); } catch {}
      }
    }
  } catch {}

  // Checkpoints on disk at boot either (a) represent a crashed run we
  // can still resume (we keep them) or (b) are stale. We DON'T wipe them
  // automatically — the UI surfaces resumable checkpoints to the user,
  // who can either hit "Resume" or delete the session.

  // Auto-summarize old memory entries (non-blocking, skip if it fails)
  autoSummarize(hub, bedrockFactory).catch((err) => {
    console.error("[memory-hooks] autoSummarize error:", err.message);
  });

  // Backfill session RAG for any pre-existing sessions whose .rag.db is
  // missing or partial. Idempotent (indexTurn dedupes on seq+role) so it's
  // safe to run on every boot. Non-blocking — server is already accepting
  // requests; backfill runs in the background.
  backfillAllSessions({ sessionsDir: SESSIONS_DIR })
    .then((stats) => {
      console.log(`[session-rag] backfill complete — scanned=${stats.scanned} built=${stats.built} totalTurns=${stats.totalTurns} errors=${stats.errors}`);
    })
    .catch((err) => console.error("[session-rag] backfill error:", err.message));

  const mcpCatalog = hub.getCatalogForPrompt();
  systemPrompt = await buildSystemPrompt({ workspaceRoot: WORKSPACE_ROOT, mcpCatalog });
  console.log(`[prompt] system prompt: ${systemPrompt.length} chars`);

  // Phase 3 — provision the bearer token on disk and surface it once for
  // any operator who needs to paste it into a fresh browser tab.
  const _bootToken = ensureToken();
  logTokenForOperator(_bootToken);

  // Phase 8 — boot-time resource hygiene. Sweep orphaned uploads,
  // checkpoints with no matching session, and old .bak cruft.
  runHygienePass({
    rootDir: __dirname,
    sessionsDir: SESSIONS_DIR,
    checkpointsDir: CHECKPOINTS_DIR,
    uploadsRoot: UPLOADS_ROOT,
  });

  // Q-pass-5 P1-5 — open the SQLite write-through mirror. If a lock
  // file is present (or the mirror.db doesn't exist yet), trigger a
  // full rebuild from JSONL so cross-session search starts with the
  // current truth state. Rebuild runs async — boot does NOT block on it.
  try {
    const mirrorLockPresent = fs.existsSync(_mirrorInternals.LOCK_FILE);
    const mirrorMissing = !fs.existsSync(_mirrorInternals.MIRROR_FILE);
    _openMirror(); // creates schema + writes lock
    if (mirrorLockPresent || mirrorMissing) {
      const why = mirrorMissing ? "fresh install" : "unclean shutdown detected";
      console.log(`[mirror] rebuild trigger: ${why} — re-importing from JSONL in background`);
      _mirrorRebuild({ sessionsDir: SESSIONS_DIR })
        .then(({ summary }) => {
          console.log(`[mirror] rebuild complete — ${summary.sessions.upserted} sessions, ${summary.memory.upserted} memory, ${summary.kg.nodes}+${summary.kg.edges} kg`);
        })
        .catch((err) => console.error("[mirror] rebuild failed:", err.message));
    } else {
      console.log("[mirror] clean — incremental write-through active");
    }
  } catch (e) {
    console.warn(`[mirror] init failed (non-fatal, JSONL truth unchanged): ${e.message}`);
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n  ✓ Ares Chat ready at http://${HOST}:${PORT}`);
    // Phase Q1 — banner the Q UI when its build artefact is present.
    if (fs.existsSync(Q_DIR) && fs.existsSync(path.join(Q_DIR, "index.html"))) {
      console.log(`  ✓ Ares Q UI available at http://${HOST}:${PORT}/q/`);
    } else {
      console.log(`  · Q UI not built yet — run \`cd ../ares-ui && npm run build\` to populate /q/`);
    }
    console.log("");
  });

  // Start the jobs runner (KPI cache, morning brief, ticket watcher, vendor
  // mail resolver, COST_METRICS expiry). Reads schedule + enable state from
  // sessions/jobs.db. Each tick fires at most one run per job.
  jobRunner = new JobRunner({ hub, bedrockFactory, sessionsDir: SESSIONS_DIR, systemPrompt });
  jobRunner.start();

  // Q-pass-2 — predictive Activity Feed watchers.
  try {
    const { startFeedWatchers } = await import("./lib/feed/index.js");
    startFeedWatchers({
      hub,
      haikuFactory: () => bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
    });
  } catch (e) {
    console.warn(`[feed] watchers failed to start: ${e.message}`);
  }

  // Q-pass-4 (E) — wire the unified activity-stream bus to the jobRunner
  // and feed-hub event emitters so /api/activity/stream surfaces both
  // sources. Approval / error / memory frames are emitted ad-hoc from the
  // relevant code paths (agent loop, approval gate, auto-record path).
  try {
    const { wireActivityStream } = await import("./lib/activity-stream.js");
    const { getEvents } = await import("./lib/feed/index.js");
    wireActivityStream({ jobRunner, feedHub: getEvents() });
  } catch (e) {
    console.warn(`[activity-stream] wire failed: ${e.message}`);
  }

  // Q-pass-2 — knowledge-graph post-turn auto-mapper. Cron pass runs
  // every 6h to pick up Slack/Outlook entities; the per-turn hook is
  // wired into agent.js directly.
  try {
    const { startGraphRefresh } = await import("./lib/knowledge-graph-builder.js");
    startGraphRefresh({
      hub,
      haikuFactory: () => bedrockFactory(process.env.ARES_HAIKU_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
    });
  } catch (e) {
    console.warn(`[kg] refresh failed to start: ${e.message}`);
  }

  // STS warmup — every 30 min, resolve the AWS credential provider chain.
  // isengardcli refreshes the STS session token lazily on each call, so
  // forcing one here keeps the AWS SDK's in-process cache fresh and
  // prevents the "Could not load credentials" error from biting mid-chat.
  //
  // If the refresh fails, we log once (not every tick) so the operator
  // knows auth-init is needed, but we don't crash the server.
  const WARMUP_INTERVAL_MS = 30 * 60 * 1000;
  let warmupLastState = null; // "ok" | "stale"
  async function warmupCredentials() {
    try {
      const provider = fromNodeProviderChainCheck(PROFILE ? { profile: PROFILE } : {});
      const creds = await provider();
      const exp = creds.expiration instanceof Date ? creds.expiration : null;
      const minutesLeft = exp ? Math.round((exp.getTime() - Date.now()) / 60000) : null;
      if (warmupLastState !== "ok") {
        console.log(`[aws-warmup] ✓ credentials healthy${minutesLeft != null ? ` — expire in ${minutesLeft} min` : ""}`);
      }
      warmupLastState = "ok";
    } catch (err) {
      const msg = (err && err.message) || String(err);
      if (warmupLastState !== "stale") {
        console.error(`[aws-warmup] ⚠ stale — ${msg.split("\n")[0]}. Run auth-init to refresh.`);
      }
      warmupLastState = "stale";
    }
  }
  // C-4: warm credentials at boot (don't wait 60 s). Pre-fix the first
  // request after a freshly-booted server with stale STS would discover
  // the expiry mid-stream and have to refresh + resume; warming now
  // means the cache is populated before any request arrives.
  setImmediate(() => warmupCredentials().catch(() => {}));
  // Keep the deferred + periodic warmup as a belt-and-braces fallback.
  // C-5: keep handles so gracefulShutdown can clear them.
  _warmupTimers.boot = setTimeout(warmupCredentials, 60 * 1000);
  _warmupTimers.tick = setInterval(warmupCredentials, WARMUP_INTERVAL_MS);
})().catch((err) => {
  console.error("boot failed:", err);
  process.exit(1);
});

// =====================================================================
// Phase 1 — Process safety net.
// Without these handlers, any unawaited promise rejection or thrown error
// in a non-request code path silently kills the process; launchd then
// restarts it, producing a crash loop. With these, we log the cause and
// exit deliberately so launchd's KeepAlive back-off has something to
// rate-limit against.
// =====================================================================
process.on("unhandledRejection", (reason, promise) => {
  console.error("[fatal] unhandledRejection:",
    reason?.stack || reason?.message || String(reason));
  // Don't exit immediately — give in-flight HTTP responses a chance to flush.
  setTimeout(() => process.exit(1), 250);
});
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err?.stack || err?.message || String(err));
  setTimeout(() => process.exit(1), 250);
});

// Graceful shutdown — both SIGINT (Ctrl+C) and SIGTERM (launchctl kickstart -k).
async function gracefulShutdown(signal) {
  console.log(`\n[shutdown] ${signal} received — closing MCPs + stopping jobs`);
  // C-5: clear warmup timers so they don't fire into a half-shut process.
  try { if (_warmupTimers.boot) clearTimeout(_warmupTimers.boot); } catch {}
  try { if (_warmupTimers.tick) clearInterval(_warmupTimers.tick); } catch {}
  // C-2: stop the integrity validator's recursive setTimeout chain.
  try { _integrityValidator?.stop(); } catch {}
  try { jobRunner?.stop(); } catch (e) { console.warn("[shutdown] jobRunner.stop:", e.message); }
  try { await hub.close(); } catch (e) { console.warn("[shutdown] hub.close:", e.message); }
  // D-12: close every cached session-RAG DB so WAL files flush cleanly.
  try { closeAllRagDbs(); } catch (e) { console.warn("[shutdown] closeAllRagDbs:", e.message); }
  // Q-pass-5 P1-5 — flush queued mirror writes, stamp clean shutdown,
  // and remove the lock file so next boot doesn't rebuild.
  try { _markMirrorClean(); _closeMirror(); } catch (e) { console.warn("[shutdown] mirror close:", e.message); }
  process.exit(0);
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
