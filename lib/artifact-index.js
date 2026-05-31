// Q-pass-3 (work-stream C) — artifact index.
//
// Walks `sessions/*.json` + `uploads/<sessionId>/` to produce a flat list of
// artifact records consumable by the Q UI's "My stuff" page.
//
// An "artifact" here is anything the user might want to open from a single
// library view:
//   - "user-upload"     — files the user dragged into the composer (read off
//                          the `_attachments` array on user messages, OR off
//                          a top-level `attachedFiles[]` if the session has
//                          one, OR by walking `uploads/<sid>/` on disk).
//   - "assistant-output" — files the assistant wrote via `fs_write` /
//                          `filesystem-agent__fs_write` tool calls. We sniff
//                          the assistant's `tool_use` blocks for these and
//                          record the path.
//
// Shape:
//   {
//     id:          string  (deterministic = sha1(`${sessionId}:${kind}:${name}`))
//     name:        string  (basename)
//     format:      string  (lowercase ext sans dot, or "file")
//     sizeBytes:   number  (stat() of resolved path; 0 if missing)
//     sessionId:   string
//     sessionTitle:string
//     createdAt:   number  (ms epoch)
//     kind:        "user-upload" | "assistant-output"
//     path:        string  (absolute disk path; the UI doesn't get this but
//                          the server uses it to build /uploads/<sid>/<name>)
//   }
//
// Caching:
//   Internal Map<sessionId, ArtifactRecord[]> keyed by mtime. Cached entries
//   skipped when the underlying file hasn't changed. The cache invalidator
//   `invalidate(sessionId)` is called from server.js's saveSessionToDisk.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const _byteFormatExtIgnore = new Set([".bak", ".tmp", ".lock", ".swp"]);

// Per-session cache: sessionId → { sessionMtime, uploadsMtime, items }
const _cache = new Map();

/**
 * Drop the cache entry for a session so the next index walk re-scans it.
 * Called on every saveSessionToDisk so freshly-logged artifacts surface
 * within one HTTP roundtrip.
 */
export function invalidate(sessionId) {
  if (!sessionId) return;
  _cache.delete(sessionId);
}

/** Drop the entire cache. Useful when the index endpoint is asked to refresh hard. */
export function invalidateAll() {
  _cache.clear();
}

function _hashId(sessionId, kind, name) {
  return crypto
    .createHash("sha1")
    .update(`${sessionId}:${kind}:${name}`)
    .digest("hex")
    .slice(0, 16);
}

function _formatFromName(name) {
  const ext = path.extname(name || "").toLowerCase();
  if (!ext) return "file";
  return ext.slice(1);
}

function _safeStatSize(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() ? st.size : 0;
  } catch { return 0; }
}

function _safeStatMtime(p) {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

function _readSession(sessionsDir, sessionId) {
  const p = path.join(sessionsDir, `${sessionId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return { data: JSON.parse(fs.readFileSync(p, "utf8")), mtimeMs: fs.statSync(p).mtimeMs };
  } catch { return null; }
}

function _deriveTitle(session) {
  if (session?.title && session.title.trim()) return session.title.trim();
  for (const m of session?.messages || []) {
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content.slice(0, 70);
    if (Array.isArray(m.content)) {
      const t = m.content.find((c) => c?.type === "text");
      if (t?.text) {
        const cleaned = t.text
          .replace(/<(file|attachment)[^>]*>[\s\S]*?<\/\1>/gi, "")
          .replace(/<(file|attachment)[^>]*>[\s\S]*$/gi, "")
          .replace(/[`*_#>]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (cleaned) return cleaned.slice(0, 70);
      }
    }
  }
  return "New chat";
}

function _collectUserUploads(session, sessionId, uploadsRoot) {
  const out = [];
  const seen = new Set();
  const sessionDir = path.join(uploadsRoot, sessionId);
  // 1) Walk message-level _attachments (the canonical record).
  for (const m of session?.messages || []) {
    if (m.role !== "user") continue;
    const att = Array.isArray(m._attachments) ? m._attachments : [];
    for (const a of att) {
      if (!a?.name) continue;
      const key = `u:${a.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = a.path || path.join(sessionDir, a.name);
      out.push({
        id:          _hashId(sessionId, "user-upload", a.name),
        name:        a.name,
        format:      _formatFromName(a.name),
        sizeBytes:   typeof a.sizeBytes === "number" ? a.sizeBytes : _safeStatSize(p),
        sessionId,
        sessionTitle:"", // filled later
        createdAt:   m.createdAt || session?.createdAt || _safeStatMtime(p) || Date.now(),
        kind:        "user-upload",
        path:        p,
      });
    }
  }
  // 2) Top-level attachedFiles[] (some legacy / future code paths land here).
  for (const a of Array.isArray(session?.attachedFiles) ? session.attachedFiles : []) {
    if (!a?.name) continue;
    const key = `u:${a.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = a.path || path.join(sessionDir, a.name);
    out.push({
      id:          _hashId(sessionId, "user-upload", a.name),
      name:        a.name,
      format:      _formatFromName(a.name),
      sizeBytes:   typeof a.sizeBytes === "number" ? a.sizeBytes : _safeStatSize(p),
      sessionId,
      sessionTitle:"",
      createdAt:   a.createdAt || session?.createdAt || _safeStatMtime(p) || Date.now(),
      kind:        "user-upload",
      path:        p,
    });
  }
  // 3) Walk the on-disk uploads dir for this session — picks up files
  //    multer wrote that the messages don't reference (the request was
  //    aborted before /api/chat got the attachments echoed back).
  if (fs.existsSync(sessionDir)) {
    let entries = [];
    try { entries = fs.readdirSync(sessionDir); } catch {}
    for (const name of entries) {
      const ext = path.extname(name).toLowerCase();
      if (_byteFormatExtIgnore.has(ext)) continue;
      const key = `u:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = path.join(sessionDir, name);
      out.push({
        id:          _hashId(sessionId, "user-upload", name),
        name,
        format:      _formatFromName(name),
        sizeBytes:   _safeStatSize(p),
        sessionId,
        sessionTitle:"",
        createdAt:   _safeStatMtime(p) || Date.now(),
        kind:        "user-upload",
        path:        p,
      });
    }
  }
  return out;
}

function _collectAssistantOutputs(session, sessionId) {
  const out = [];
  const seen = new Set();
  for (const m of session?.messages || []) {
    if (m.role !== "assistant") continue;
    if (!Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (!block || block.type !== "tool_use") continue;
      const name = (block.name || "").toLowerCase();
      // Look for fs_write across MCP namespaces.
      if (!/fs[_-]?write/.test(name)) continue;
      const input = block.input || {};
      const filePath = input.path || input.filePath || input.file_path || input.target || null;
      if (typeof filePath !== "string" || !filePath) continue;
      const baseName = path.basename(filePath);
      const key = `a:${filePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id:          _hashId(sessionId, "assistant-output", filePath),
        name:        baseName,
        format:      _formatFromName(baseName),
        sizeBytes:   _safeStatSize(filePath),
        sessionId,
        sessionTitle:"",
        createdAt:   m.createdAt || session?.updatedAt || session?.createdAt || Date.now(),
        kind:        "assistant-output",
        path:        filePath,
      });
    }
  }
  return out;
}

/**
 * List artifacts for one session — using the cache when fresh.
 * Public so server.js can prime it on save.
 */
export function indexSession({ sessionsDir, uploadsRoot, sessionId }) {
  if (!sessionId) return [];
  const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
  const sessionMtime = _safeStatMtime(sessionFile);
  const uploadDir = path.join(uploadsRoot, sessionId);
  const uploadsMtime = _safeStatMtime(uploadDir);
  const cached = _cache.get(sessionId);
  if (cached && cached.sessionMtime === sessionMtime && cached.uploadsMtime === uploadsMtime) {
    return cached.items;
  }
  const loaded = _readSession(sessionsDir, sessionId);
  if (!loaded) {
    _cache.set(sessionId, { sessionMtime, uploadsMtime, items: [] });
    return [];
  }
  const session = loaded.data;
  const title = _deriveTitle(session);
  const items = [
    ..._collectUserUploads(session, sessionId, uploadsRoot),
    ..._collectAssistantOutputs(session, sessionId),
  ].map((it) => ({ ...it, sessionTitle: title }));
  _cache.set(sessionId, { sessionMtime, uploadsMtime, items });
  return items;
}

/**
 * List ALL artifacts across the sessions dir, sorted desc by createdAt.
 * Empty / missing dirs return []. Each session is independently cached,
 * so subsequent calls only re-scan changed sessions.
 */
export function listArtifacts({ sessionsDir, uploadsRoot }) {
  if (!sessionsDir || !fs.existsSync(sessionsDir)) return [];
  let entries = [];
  try { entries = fs.readdirSync(sessionsDir); } catch { return []; }
  const all = [];
  for (const f of entries) {
    if (!f.endsWith(".json")) continue;
    const sessionId = f.replace(/\.json$/, "");
    for (const it of indexSession({ sessionsDir, uploadsRoot, sessionId })) {
      // Strip the absolute disk `path` before returning to a caller that
      // forwards over HTTP — server.js can re-derive it at preview time.
      const { path: _abs, ...rest } = it;
      all.push(rest);
    }
  }
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return all;
}

/** Test-only helper. */
export function _resetForTests() {
  _cache.clear();
}
