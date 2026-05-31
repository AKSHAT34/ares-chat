// Q-pass-3 (D) — diagnostics tar.gz bundle for the Settings UI.
//
// Collects:
//   - tail of /tmp/ares-chat.out.log + /tmp/ares-chat.err.log (last 1MB each)
//   - ~/.ares/feed-config.json + ~/.ares/feed-instructions.json
//   - last 5 sessions/<id>.json modified within the window
//   - first 200 lines of ~/.ares/knowledge-graph.jsonl
//   - a manifest.json with timestamps + window
//
// Emits a gzipped tar archive via Node built-ins (no external deps).
// USTAR header per https://www.gnu.org/software/tar/manual/html_node/Standard.html

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";

const ARES_HOME = path.join(os.homedir(), ".ares");
const KG_FILE = path.join(ARES_HOME, "knowledge-graph.jsonl");
const FEED_CONFIG = path.join(ARES_HOME, "feed-config.json");
const FEED_INSTRUCTIONS = path.join(ARES_HOME, "feed-instructions.json");

const HOUR_MS = 60 * 60 * 1000;
export const SINCE_OPTIONS = {
  "1h":  1 * HOUR_MS,
  "2h":  2 * HOUR_MS,
  "6h":  6 * HOUR_MS,
  "24h": 24 * HOUR_MS,
  all:   null, // no cutoff
};

function _safeRead(file, byteCap = 1024 * 1024) {
  try {
    const stat = fs.statSync(file);
    if (stat.size <= byteCap) return fs.readFileSync(file);
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(byteCap);
      fs.readSync(fd, buf, 0, byteCap, Math.max(0, stat.size - byteCap));
      return buf;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}

function _readHead(file, lineCap) {
  try {
    const txt = fs.readFileSync(file, "utf8");
    const lines = txt.split("\n").slice(0, lineCap);
    return Buffer.from(lines.join("\n"), "utf8");
  } catch { return null; }
}

function _listSessions(sessionsDir, sinceMs, max = 5) {
  try {
    const entries = fs.readdirSync(sessionsDir)
      .filter((n) => n.endsWith(".json"))
      .map((n) => {
        const full = path.join(sessionsDir, n);
        try { return { full, name: n, mtime: fs.statSync(full).mtimeMs }; }
        catch { return null; }
      })
      .filter(Boolean);
    let filtered = entries;
    if (sinceMs != null) {
      const cutoff = Date.now() - sinceMs;
      filtered = entries.filter((e) => e.mtime >= cutoff);
    }
    filtered.sort((a, b) => b.mtime - a.mtime);
    return filtered.slice(0, max);
  } catch { return []; }
}

// ── Minimal USTAR writer ────────────────────────────────────────────
// Each file = 512-byte header + content padded to 512. Archive ends
// with two zero-filled 512-byte blocks.

function _padTo512(buf) {
  const rem = buf.length % 512;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(512 - rem)]);
}

function _ustarHeader(name, size, mtime = Math.floor(Date.now() / 1000)) {
  if (Buffer.byteLength(name, "utf8") > 100) {
    name = name.slice(-100); // tar's "name" field is 100 bytes
  }
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644 ", 100, 8, "ascii");        // mode
  header.write("0000000 ", 108, 8, "ascii");        // uid
  header.write("0000000 ", 116, 8, "ascii");        // gid
  header.write(size.toString(8).padStart(11, "0") + " ", 124, 12, "ascii"); // size
  header.write(mtime.toString(8).padStart(11, "0") + " ", 136, 12, "ascii"); // mtime
  header.write("        ", 148, 8, "ascii");        // chksum placeholder
  header.write("0", 156, 1, "ascii");               // typeflag = '0' regular
  header.write("ustar  \0", 257, 8, "ascii");       // magic+version (GNU style)
  // Compute checksum.
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return header;
}

function _tarEntry(name, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
  return Buffer.concat([_ustarHeader(name, buf.length), _padTo512(buf)]);
}

function _tarFinish(parts) {
  return Buffer.concat([...parts, Buffer.alloc(1024)]);
}

/**
 * Build the diagnostics archive.
 * @param {object} opts
 * @param {string} opts.since  one of "1h"|"2h"|"6h"|"24h"|"all"
 * @param {string} [opts.sessionsDir]  defaults to ${cwd}/sessions
 * @returns {Promise<Buffer>}  gzipped tar
 */
export async function buildDiagnosticsArchive({ since = "1h", sessionsDir } = {}) {
  if (!Object.prototype.hasOwnProperty.call(SINCE_OPTIONS, since)) {
    throw new Error(`bad since: ${since}`);
  }
  const sinceMs = SINCE_OPTIONS[since];
  const parts = [];

  const manifest = {
    generatedAt: new Date().toISOString(),
    since,
    files: [],
  };

  // logs
  for (const [label, file] of [
    ["ares-chat.out.log", "/tmp/ares-chat.out.log"],
    ["ares-chat.err.log", "/tmp/ares-chat.err.log"],
  ]) {
    const buf = _safeRead(file, 1024 * 1024);
    if (buf) {
      parts.push(_tarEntry(`logs/${label}`, buf));
      manifest.files.push({ path: `logs/${label}`, source: file, bytes: buf.length });
    }
  }

  // ~/.ares config files
  for (const [name, file] of [
    ["feed-config.json", FEED_CONFIG],
    ["feed-instructions.json", FEED_INSTRUCTIONS],
  ]) {
    const buf = _safeRead(file, 256 * 1024);
    if (buf) {
      parts.push(_tarEntry(`ares-home/${name}`, buf));
      manifest.files.push({ path: `ares-home/${name}`, source: file, bytes: buf.length });
    }
  }

  // sessions
  if (sessionsDir) {
    const sessions = _listSessions(sessionsDir, sinceMs, 5);
    for (const s of sessions) {
      const buf = _safeRead(s.full, 512 * 1024);
      if (buf) {
        parts.push(_tarEntry(`sessions/${s.name}`, buf));
        manifest.files.push({
          path: `sessions/${s.name}`,
          mtime: new Date(s.mtime).toISOString(),
          bytes: buf.length,
        });
      }
    }
  }

  // kg head
  const kg = _readHead(KG_FILE, 200);
  if (kg) {
    parts.push(_tarEntry("knowledge-graph.head.jsonl", kg));
    manifest.files.push({ path: "knowledge-graph.head.jsonl", lines: 200, bytes: kg.length });
  }

  // manifest last so it can summarise everything that came before
  parts.unshift(_tarEntry("manifest.json", JSON.stringify(manifest, null, 2)));

  const tarball = _tarFinish(parts);
  return zlib.gzipSync(tarball);
}
