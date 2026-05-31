// Q-pass-3 work-stream E — indexed-folders + index-config persistence.
//
// "My computer" surfaces a list of local folders the user has opted in to
// indexing, plus a small budget config (storage limit, max file size,
// max folder size). Persistence uses two flat JSON files under ~/.ares/:
//
//   ~/.ares/indexed-folders.json   array of { id, path, name, ... }
//   ~/.ares/index-config.json      { storageLimitGiB, maxFileMiB, maxFolderMiB }
//
// The actual indexing pipeline (chunking, embedding, vector store) is NOT
// part of this surface — that's a separate follow-up phase. This module
// only owns the registry + budget knobs the UI binds to.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const ARES_DIR = path.join(os.homedir(), ".ares");
const FOLDERS_FILE = path.join(ARES_DIR, "indexed-folders.json");
const CONFIG_FILE = path.join(ARES_DIR, "index-config.json");

const DEFAULT_CONFIG = Object.freeze({
  storageLimitGiB: 4,
  maxFileMiB: 32,
  maxFolderMiB: 128,
});

// Paths we refuse to index — too large, too sensitive, or system-critical.
// Compared after path resolution + trailing-slash strip.
const BANNED_PATHS = new Set([
  "/",
  "/usr",
  "/Applications",
  "/System",
  "/Library",
  os.homedir(),
]);

function _ensureDir() {
  try { fs.mkdirSync(ARES_DIR, { recursive: true }); } catch {}
}

function _readJson(filepath, fallback) {
  try {
    if (!fs.existsSync(filepath)) return fallback;
    const raw = fs.readFileSync(filepath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function _writeJson(filepath, data) {
  _ensureDir();
  const tmp = `${filepath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filepath);
}

export function listFolders() {
  const arr = _readJson(FOLDERS_FILE, []);
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => ({
    id: String(f.id || ""),
    path: String(f.path || ""),
    name: String(f.name || path.basename(f.path || "")),
    indexedAt: f.indexedAt ?? null,
    sizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : 0,
    status: f.status || "queued",
  }));
}

function _saveFolders(arr) { _writeJson(FOLDERS_FILE, arr); }

/**
 * Validate a candidate folder path. Returns { ok, reason }.
 * - Must be absolute
 * - Must exist + be a directory + readable
 * - Must NOT be one of the banned paths
 * - Must NOT be exactly $HOME (allow subdirs of $HOME though)
 */
export function validateFolderPath(p) {
  if (typeof p !== "string" || !p.trim()) return { ok: false, reason: "path required" };
  let resolved;
  try {
    resolved = path.resolve(p.replace(/^~(?=\/|$)/, os.homedir()));
  } catch (e) {
    return { ok: false, reason: `cannot resolve path: ${e.message}` };
  }
  // Strip trailing slash for the ban check.
  const stripped = resolved.replace(/\/+$/, "") || "/";
  if (BANNED_PATHS.has(stripped)) {
    return { ok: false, reason: `path "${stripped}" is reserved and cannot be indexed` };
  }
  let st;
  try { st = fs.statSync(resolved); } catch (e) {
    return { ok: false, reason: `path does not exist: ${e.code || e.message}` };
  }
  if (!st.isDirectory()) return { ok: false, reason: "path is not a directory" };
  try { fs.accessSync(resolved, fs.constants.R_OK); }
  catch { return { ok: false, reason: "path is not readable" }; }
  return { ok: true, resolved };
}

export function addFolder(rawPath) {
  const v = validateFolderPath(rawPath);
  if (!v.ok) {
    const err = new Error(v.reason);
    err.code = "INVALID_PATH";
    throw err;
  }
  const arr = listFolders();
  const existing = arr.find((f) => f.path === v.resolved);
  if (existing) return existing;
  const folder = {
    id: crypto.randomBytes(8).toString("hex"),
    path: v.resolved,
    name: path.basename(v.resolved) || v.resolved,
    indexedAt: null,
    sizeBytes: 0,
    status: "queued",
  };
  arr.push(folder);
  _saveFolders(arr);
  return folder;
}

export function removeFolder(id) {
  const arr = listFolders();
  const idx = arr.findIndex((f) => f.id === id);
  if (idx < 0) return false;
  arr.splice(idx, 1);
  _saveFolders(arr);
  return true;
}

/**
 * Mark a folder as queued for re-index. The actual indexing pipeline is a
 * follow-up phase — for now we just bump the status + clear indexedAt.
 */
export function reindexFolder(id) {
  const arr = listFolders();
  const f = arr.find((x) => x.id === id);
  if (!f) return null;
  f.status = "queued";
  f.indexedAt = null;
  _saveFolders(arr);
  return f;
}

export function getConfig() {
  const cfg = _readJson(CONFIG_FILE, null);
  if (!cfg || typeof cfg !== "object") return { ...DEFAULT_CONFIG };
  return {
    storageLimitGiB: clamp(num(cfg.storageLimitGiB, DEFAULT_CONFIG.storageLimitGiB), 0.5, 32),
    maxFileMiB: clamp(num(cfg.maxFileMiB, DEFAULT_CONFIG.maxFileMiB), 1, 256),
    maxFolderMiB: clamp(num(cfg.maxFolderMiB, DEFAULT_CONFIG.maxFolderMiB), 32, 2048),
  };
}

export function setConfig(patch) {
  const cur = getConfig();
  const next = {
    storageLimitGiB: clamp(num(patch?.storageLimitGiB, cur.storageLimitGiB), 0.5, 32),
    maxFileMiB:      clamp(num(patch?.maxFileMiB,      cur.maxFileMiB),      1, 256),
    maxFolderMiB:    clamp(num(patch?.maxFolderMiB,    cur.maxFolderMiB),    32, 2048),
  };
  _writeJson(CONFIG_FILE, next);
  return next;
}

function num(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Best-effort directory size sum. Bounded by maxBytes so a runaway tree
 * doesn't pin the event loop. Returns the partial total when capped.
 * Synchronous + fs.statSync — only call from /api/diskspace where the
 * caller is OK with a few ms of work.
 */
export function dirSizeBytes(dir, { maxBytes = 8 * 1024 * 1024 * 1024 } = {}) {
  let total = 0;
  function walk(d) {
    if (total > maxBytes) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (total > maxBytes) return;
      const p = path.join(d, e.name);
      try {
        if (e.isFile()) {
          const st = fs.statSync(p);
          total += st.size;
        } else if (e.isDirectory()) {
          walk(p);
        }
      } catch {}
    }
  }
  try { walk(dir); } catch {}
  return total;
}

export function diskSpace() {
  // Try statfs (node 18.15+). Fall back to df.
  let free = 0;
  let total = 0;
  try {
    if (typeof fs.statfsSync === "function") {
      const st = fs.statfsSync(os.homedir());
      const blockSize = st.bsize || 4096;
      free = Number(st.bavail || 0) * blockSize;
      total = Number(st.blocks || 0) * blockSize;
    }
  } catch {}
  if (!total) {
    // Last-resort df fallback. Synchronous — but only on this code path.
    try {
      const out = execSync(`df -k ${JSON.stringify(os.homedir())}`, { encoding: "utf8" });
      const lines = out.trim().split("\n");
      const last = lines[lines.length - 1].split(/\s+/);
      total = Number(last[1] || 0) * 1024;
      free = Number(last[3] || 0) * 1024;
    } catch {}
  }
  let usedAres = 0;
  try { usedAres = dirSizeBytes(ARES_DIR, { maxBytes: 5 * 1024 * 1024 * 1024 }); } catch {}
  // Fold in the cached sizeBytes of every indexed folder for a richer
  // "used (M MiB)" readout in the UI.
  let usedFolders = 0;
  for (const f of listFolders()) usedFolders += (f.sizeBytes || 0);
  return { free, total, usedAres, usedFolders };
}
