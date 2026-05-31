// Phase 8 — boot-time resource hygiene.
//
// Three classes of cruft accumulate over time:
//   1. Uploads dir for sessions that no longer exist (deleted some other
//      way than DELETE /api/sessions/:id, or never written at all).
//   2. Checkpoint files for sessions with no current matching session.json.
//   3. Stale .bak / .bak.<timestamp> / ~ files left by old edit sessions.
//
// All three are best-effort cleanups. Failures log and move on; we never
// crash the server because of GC.

import fs from "node:fs";
import path from "node:path";

/**
 * Remove uploads/<id>/ directories whose sessionId has no matching
 * session.json file. Returns { scanned, removed, freedBytes }.
 *
 * Special case: uploads/unassigned/ is preserved — multipart uploads
 * that haven't been bound to a session yet park there.
 */
export function gcOrphanUploads({ uploadsRoot, sessionsDir }) {
  const result = { scanned: 0, removed: 0, freedBytes: 0 };
  if (!fs.existsSync(uploadsRoot)) return result;
  const sessionFiles = new Set(
    fs.readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
  );
  for (const entry of fs.readdirSync(uploadsRoot)) {
    if (entry === "unassigned" || entry.startsWith(".")) continue;
    const dir = path.join(uploadsRoot, entry);
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) continue;
    result.scanned += 1;
    if (sessionFiles.has(entry)) continue;
    // Orphan — sum size, remove.
    let bytes = 0;
    try {
      for (const f of fs.readdirSync(dir)) {
        try { bytes += fs.statSync(path.join(dir, f)).size; } catch {}
      }
    } catch {}
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      result.removed += 1;
      result.freedBytes += bytes;
    } catch (e) {
      // Best effort.
    }
  }
  return result;
}

/**
 * Drop checkpoint files whose sessionId has no matching session.json.
 * Returns { scanned, removed }.
 */
export function gcOrphanCheckpoints({ checkpointsDir, sessionsDir }) {
  const result = { scanned: 0, removed: 0 };
  if (!fs.existsSync(checkpointsDir)) return result;
  const sessionFiles = new Set(
    fs.readdirSync(sessionsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
  );
  for (const f of fs.readdirSync(checkpointsDir)) {
    if (!f.endsWith(".json")) continue;
    result.scanned += 1;
    const id = f.replace(/\.json$/, "");
    if (sessionFiles.has(id)) continue;
    try {
      fs.unlinkSync(path.join(checkpointsDir, f));
      result.removed += 1;
    } catch {}
  }
  return result;
}

/**
 * Recursively find and remove `.bak`, `.bak.<anything>`, and editor
 * tilde files (`foo.js~`) under `root`. Skips node_modules.
 *
 * Returns { scanned, removed, paths[] }.
 */
export function gcBakCruft({ root, maxAgeMs = 7 * 24 * 60 * 60 * 1000 }) {
  const result = { scanned: 0, removed: 0, paths: [] };
  const cutoff = Date.now() - maxAgeMs;
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name === "node_modules" || ent.name === ".git" || ent.name.startsWith(".")) continue;
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) { stack.push(p); continue; }
      if (!ent.isFile()) continue;
      const isBak = /\.bak(\.\d+)?$|\.bak\.\d{8}-\d{6}$|~$/.test(ent.name);
      if (!isBak) continue;
      result.scanned += 1;
      // Only remove if older than cutoff so very recent backups (within a
      // hot edit loop) survive.
      let mtime = 0;
      try { mtime = fs.statSync(p).mtimeMs; } catch { continue; }
      if (mtime > cutoff) continue;
      try {
        fs.unlinkSync(p);
        result.removed += 1;
        result.paths.push(p);
      } catch {}
    }
  }
  return result;
}

/**
 * D-16 — drop orphan SQLite WAL/SHM sidecar files under sessionsDir
 * whose primary `<id>.rag.db` is missing. These are usually left by a
 * crashed mid-write SQLite; if the parent DB has since been deleted,
 * the sidecars cannot be opened safely and just sit on disk.
 *
 * Returns { scanned, removed }.
 */
export function gcOrphanRagSidecars({ sessionsDir }) {
  const result = { scanned: 0, removed: 0 };
  if (!fs.existsSync(sessionsDir)) return result;
  const files = fs.readdirSync(sessionsDir);
  const dbBases = new Set(files.filter((f) => f.endsWith(".rag.db")));
  for (const f of files) {
    const m = f.match(/^(.+\.rag\.db)-(wal|shm)$/);
    if (!m) continue;
    result.scanned += 1;
    if (dbBases.has(m[1])) continue;
    try {
      fs.unlinkSync(path.join(sessionsDir, f));
      result.removed += 1;
    } catch {}
  }
  return result;
}

/**
 * Run all GC passes and log a single line summarising what was cleaned.
 * Safe to call at boot; never throws.
 */
export function runHygienePass({ rootDir, sessionsDir, checkpointsDir, uploadsRoot, log = console.log }) {
  try {
    const u = gcOrphanUploads({ uploadsRoot, sessionsDir });
    const c = gcOrphanCheckpoints({ checkpointsDir, sessionsDir });
    const r = gcOrphanRagSidecars({ sessionsDir });
    const b = gcBakCruft({ root: rootDir });
    if (u.removed || c.removed || b.removed || r.removed) {
      log(
        `[hygiene] uploads=${u.removed}/${u.scanned} (freed ${(u.freedBytes / 1024 / 1024).toFixed(1)} MB), ` +
        `checkpoints=${c.removed}/${c.scanned}, ` +
        `rag-sidecars=${r.removed}/${r.scanned}, ` +
        `bak-cruft=${b.removed}/${b.scanned}`
      );
    } else {
      log(`[hygiene] clean — scanned uploads=${u.scanned} checkpoints=${c.scanned} rag-sidecars=${r.scanned} bak=${b.scanned}`);
    }
    return { uploads: u, checkpoints: c, ragSidecars: r, bak: b };
  } catch (e) {
    log(`[hygiene] pass failed: ${e.message}`);
    return null;
  }
}
