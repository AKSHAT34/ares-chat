// Phase 4 — session persistence integrity.
//
// Session JSON on disk is the long-lived source of truth: agent reload,
// SSE replay, search, the UI history pane all build on it. A corrupt
// session will at best fail to render, at worst crash the agent loop
// (Bedrock rejects unbalanced tool_use/tool_result pairs).
//
// This module provides three primitives:
//   1. validateMessages(messages)   → { ok, errors[] }   — pure read-only
//      invariant check; never mutates. Used at write time and in the
//      audit gate. Returns a list of every violation it finds (we don't
//      stop at the first one; the audit wants a full picture).
//   2. repairMessages(messages)     → repaired copy. Identical contract
//      to the agent's _sanitizeMessages: drop orphan tool_result blocks
//      whose tool_use isn't immediately above, synthesise stub
//      tool_result blocks for assistant tool_use that lost its response.
//      Idempotent — repair(repair(x)) === repair(x).
//   3. atomicWriteJson(path, obj)   — write via tmp + rename so a crash
//      mid-write never leaves a half-flushed session file.
//
// Validation rules (in priority order — earliest in this list is most
// catastrophic):
//   E_BAD_SHAPE     session isn't an object / messages isn't an array
//   E_BAD_ROLE      message.role not in {user, assistant}
//   E_BAD_CONTENT   message.content not string and not array
//   E_EMPTY_CONTENT message.content is [] (Bedrock rejects)
//   E_BAD_BLOCK     content block has no `type` or unknown type
//   E_ORPHAN_TR     tool_result whose tool_use_id has no matching
//                   tool_use anywhere above
//   E_NONADJACENT_TR tool_result whose matching tool_use is in the
//                   transcript but not in the *immediately preceding*
//                   assistant message (Bedrock enforces adjacency)
//   E_MISSING_TR    assistant tool_use with no matching tool_result in
//                   the next user message

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KNOWN_BLOCK_TYPES = new Set([
  "text", "tool_use", "tool_result", "image", "thinking", "redacted_thinking",
  "input_json_delta", "document",
]);

export function validateMessages(messages) {
  const errors = [];
  if (!Array.isArray(messages)) {
    return { ok: false, errors: [{ code: "E_BAD_SHAPE", msg: "messages is not an array" }] };
  }

  // Pre-compute the set of tool_use ids that exist anywhere in the transcript.
  const allToolUseIds = new Set();
  for (const m of messages) {
    if (m && m.role === "assistant" && Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b && b.type === "tool_use" && typeof b.id === "string") allToolUseIds.add(b.id);
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const at = `messages[${i}]`;

    if (!m || typeof m !== "object") {
      errors.push({ code: "E_BAD_SHAPE", at, msg: "message is not an object" });
      continue;
    }
    if (m.role !== "user" && m.role !== "assistant") {
      errors.push({ code: "E_BAD_ROLE", at, msg: `role=${JSON.stringify(m.role)}` });
    }
    if (typeof m.content !== "string" && !Array.isArray(m.content)) {
      errors.push({ code: "E_BAD_CONTENT", at, msg: `content type=${typeof m.content}` });
      continue;
    }
    if (Array.isArray(m.content) && m.content.length === 0) {
      errors.push({ code: "E_EMPTY_CONTENT", at, msg: "empty content array" });
      continue;
    }

    if (Array.isArray(m.content)) {
      for (let j = 0; j < m.content.length; j++) {
        const b = m.content[j];
        if (!b || typeof b !== "object" || typeof b.type !== "string") {
          errors.push({ code: "E_BAD_BLOCK", at: `${at}.content[${j}]`, msg: "block missing or has no type" });
          continue;
        }
        if (!KNOWN_BLOCK_TYPES.has(b.type)) {
          errors.push({ code: "E_BAD_BLOCK", at: `${at}.content[${j}]`, msg: `unknown type=${b.type}` });
        }
      }

      // Tool-result adjacency: every tool_result block on a user message
      // must reference a tool_use in the immediately preceding assistant.
      if (m.role === "user") {
        const trBlocks = m.content.filter((b) => b && b.type === "tool_result");
        if (trBlocks.length) {
          const prev = messages[i - 1];
          const adjacentIds = new Set();
          if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
            for (const b of prev.content) {
              if (b && b.type === "tool_use" && typeof b.id === "string") adjacentIds.add(b.id);
            }
          }
          for (const tr of trBlocks) {
            if (typeof tr.tool_use_id !== "string") {
              errors.push({ code: "E_BAD_BLOCK", at, msg: "tool_result missing tool_use_id" });
              continue;
            }
            if (!allToolUseIds.has(tr.tool_use_id)) {
              errors.push({ code: "E_ORPHAN_TR", at, msg: `tool_use_id=${tr.tool_use_id} has no tool_use anywhere` });
            } else if (!adjacentIds.has(tr.tool_use_id)) {
              errors.push({ code: "E_NONADJACENT_TR", at, msg: `tool_use_id=${tr.tool_use_id} not in preceding assistant` });
            }
          }
        }
      }

      // Assistant tool_use with no matching tool_result in the next user msg.
      if (m.role === "assistant") {
        const toolUseIds = m.content
          .filter((b) => b && b.type === "tool_use" && typeof b.id === "string")
          .map((b) => b.id);
        if (toolUseIds.length) {
          const next = messages[i + 1];
          const responded = new Set();
          if (next && next.role === "user" && Array.isArray(next.content)) {
            for (const b of next.content) {
              if (b && b.type === "tool_result" && typeof b.tool_use_id === "string") {
                responded.add(b.tool_use_id);
              }
            }
          }
          for (const id of toolUseIds) {
            if (!responded.has(id)) {
              errors.push({ code: "E_MISSING_TR", at, msg: `tool_use id=${id} has no tool_result in next user msg` });
            }
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Convenience wrapper that validates the session envelope, not just the
 * messages array. Returns the same shape as validateMessages.
 */
export function validateSession(session) {
  if (!session || typeof session !== "object") {
    return { ok: false, errors: [{ code: "E_BAD_SHAPE", msg: "session is not an object" }] };
  }
  if (typeof session.id !== "string" || session.id.length === 0) {
    return { ok: false, errors: [{ code: "E_BAD_SHAPE", msg: "session.id missing" }] };
  }
  return validateMessages(session.messages);
}

/**
 * Repair a messages array. Mirrors lib/agent.js::_sanitizeMessages so the
 * disk repair pass and the in-memory pre-Bedrock pass produce the same
 * output. Idempotent.
 */
export function repairMessages(messages) {
  if (!Array.isArray(messages)) return [];

  // Drop entirely malformed messages first (no role / no content). These
  // can never be made valid; preserving them only confuses the next pass.
  const clean = messages.filter((m) => {
    if (!m || typeof m !== "object") return false;
    if (m.role !== "user" && m.role !== "assistant") return false;
    if (typeof m.content !== "string" && !Array.isArray(m.content)) return false;
    if (Array.isArray(m.content) && m.content.length === 0) return false;
    return true;
  });

  // Pass 1: drop orphan / non-adjacent tool_result blocks.
  const validToolUseIds = new Set();
  for (const m of clean) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b && b.type === "tool_use" && b.id) validToolUseIds.add(b.id);
    }
  }
  const pass1 = [];
  for (const m of clean) {
    if (m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b && b.type === "tool_result")) {
      const prev = pass1[pass1.length - 1];
      const adjacentIds = new Set();
      if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
        for (const b of prev.content) if (b && b.type === "tool_use" && b.id) adjacentIds.add(b.id);
      }
      const filtered = m.content.filter((b) => {
        if (!b || b.type !== "tool_result") return true;
        return adjacentIds.has(b.tool_use_id) && validToolUseIds.has(b.tool_use_id);
      });
      if (filtered.length === 0) continue;
      pass1.push({ ...m, content: filtered });
    } else {
      pass1.push(m);
    }
  }

  // Pass 2: synthesise missing tool_result stubs.
  const pass2 = [];
  for (let i = 0; i < pass1.length; i++) {
    const m = pass1[i];
    pass2.push(m);
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    const toolUseIds = m.content.filter((b) => b && b.type === "tool_use" && b.id).map((b) => b.id);
    if (!toolUseIds.length) continue;
    const next = pass1[i + 1];
    const isNextUserWithBlocks = next && next.role === "user" && Array.isArray(next.content);
    const existing = new Set(
      isNextUserWithBlocks
        ? next.content.filter((b) => b && b.type === "tool_result" && b.tool_use_id).map((b) => b.tool_use_id)
        : []
    );
    const missing = toolUseIds.filter((id) => !existing.has(id));
    if (!missing.length) continue;
    const stubs = missing.map((id) => ({
      type: "tool_result",
      tool_use_id: id,
      content: [{ type: "text", text: "(result missing — recovered by integrity repair on session load)" }],
      is_error: true,
    }));
    if (isNextUserWithBlocks) {
      pass2.push({ ...next, content: [...stubs, ...next.content] });
      i += 1;
    } else {
      pass2.push({ role: "user", content: stubs });
    }
  }
  return pass2;
}

export function repairSession(session) {
  if (!session || typeof session !== "object") return session;
  return { ...session, messages: repairMessages(session.messages || []) };
}

/**
 * Atomic JSON write: write to a tmp file in the same directory, fsync,
 * then rename onto the target. Crash mid-write leaves the existing file
 * intact (rename(2) is atomic within a filesystem). The tmp file lives
 * next to the target so rename can't cross filesystem boundaries.
 *
 * B-17: on writeSync/fsyncSync exception, unlink the tmp file so it
 * doesn't accumulate. Pre-fix the boot hygiene pass only GC'd `.bak`
 * and `~`; tmp files (`.foo.json.<pid>.<ts>.tmp`) were left behind.
 */
export function atomicWriteJson(filePath, obj) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const json = JSON.stringify(obj, null, 2);
  const fd = fs.openSync(tmp, "w", 0o644);
  let writeOk = false;
  try {
    fs.writeSync(fd, json);
    fs.fsyncSync(fd);
    writeOk = true;
  } finally {
    try { fs.closeSync(fd); } catch {}
    if (!writeOk) {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
  fs.renameSync(tmp, filePath);
}

// ────────────── C-2: periodic background validator ──────────────
//
// Sessions are validated/repaired on read AND write today, so most code
// paths catch drift. A long-running session that nobody touches won't be
// re-checked. The background validator scans `*.json` on a timer (default
// 10 min, configurable via ARES_INTEGRITY_INTERVAL_MS) and atomic-writes
// a repaired copy if validateSession fails.
//
// Call startBackgroundValidator(...) at boot. Returns the timer handle so
// the caller can clearInterval on shutdown.

/**
 * @param {object} opts
 * @param {string} opts.sessionsDir   — directory containing `<id>.json`
 * @param {number} [opts.intervalMs]  — default 10 min
 * @param {(level: "info"|"warn", msg: string) => void} [opts.log]
 * @param {(name: string, by?: number) => void} [opts.metric] — counter hook
 * @returns {{ stop: () => void, runOnce: () => Promise<{scanned: number, repaired: number}> }}
 */
export function startBackgroundValidator({
  sessionsDir,
  intervalMs = parseInt(process.env.ARES_INTEGRITY_INTERVAL_MS || "600000", 10),
  log = () => {},
  metric = () => {},
} = {}) {
  let stopped = false;
  async function runOnce() {
    const result = { scanned: 0, repaired: 0 };
    if (!fs.existsSync(sessionsDir)) return result;
    let entries;
    try { entries = fs.readdirSync(sessionsDir); } catch { return result; }
    for (const f of entries) {
      if (!f.endsWith(".json")) continue;
      const p = path.join(sessionsDir, f);
      result.scanned += 1;
      let raw;
      try { raw = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
      if (!raw || typeof raw !== "object") continue;
      const v = validateSession(raw);
      if (v.ok) continue;
      const repaired = repairSession(raw);
      try {
        atomicWriteJson(p, repaired);
        result.repaired += 1;
        metric("ares_session_repaired_total", 1);
        log("info", `[integrity-validator] repaired ${f}: ${(v.errors || []).slice(0, 2).join("; ")}`);
      } catch (e) {
        log("warn", `[integrity-validator] could not write repaired ${f}: ${e.message}`);
      }
    }
    return result;
  }
  // Initial run after a short delay so it doesn't compete with boot.
  let t = setTimeout(async function tick() {
    if (stopped) return;
    try { await runOnce(); } catch (e) { log("warn", `[integrity-validator] tick failed: ${e.message}`); }
    if (!stopped) t = setTimeout(tick, intervalMs);
  }, 30_000);
  return {
    stop() { stopped = true; if (t) { try { clearTimeout(t); } catch {} } },
    runOnce,
  };
}
