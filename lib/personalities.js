// Q-pass-4 (work-stream E) — personality presets.
//
// A "personality" is a triple of {SOUL.md, USER.md, MEMORY.md} stored
// under ~/.kiro/personalities/<name>/. Selecting one copies all three
// files into the canonical persona directory (~/.ares/) so the next
// system-prompt assembly picks them up. The selection is therefore a
// hot-loadable preset — flip personalities, call /api/system-prompt/reload,
// the agent immediately reflects the new persona.
//
// File-shape decision: a personality directory MUST contain at least
// one of the three persona files. Missing files are skipped (we don't
// blank out the canonical version with an empty string), partial
// presets are allowed. The directory name is the personality name as
// surfaced by /api/personalities; we lowercase + trim it for safety
// when used in URLs.
//
// Source / destination:
//   source:  ~/.kiro/personalities/<name>/{SOUL,USER,MEMORY}.md
//   dest:    ~/.ares/{SOUL,USER,MEMORY}.md          (canonical persona)
//
// The destination matches lib/persona.js's resolveFiles() output so
// readPersonaFiles() in the next prompt build sees the new content.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SOURCE_DIR = path.join(os.homedir(), ".kiro", "personalities");
// Match lib/persona.js — ARES_PERSONA_DIR override, default ~/.ares.
function _personaDir() {
  return process.env.ARES_PERSONA_DIR || path.join(os.homedir(), ".ares");
}

const FILES = ["SOUL.md", "USER.md", "MEMORY.md"];

function _safeName(name) {
  return String(name || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

/** List available personalities under SOURCE_DIR.
 *  Each entry: { name, path, hasSoul, hasUser, hasMemory } */
export function listPersonalities() {
  const root = SOURCE_DIR;
  if (!fs.existsSync(root)) return [];
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    if (!_safeName(name)) continue;
    const dir = path.join(root, name);
    out.push({
      name,
      path: dir,
      hasSoul:   fs.existsSync(path.join(dir, "SOUL.md")),
      hasUser:   fs.existsSync(path.join(dir, "USER.md")),
      hasMemory: fs.existsSync(path.join(dir, "MEMORY.md")),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Copy a personality's files into the canonical persona dir.
 * Returns { copied: [...filenames], skipped: [...filenames] }.
 *
 * Safety:
 *   - Refuses unknown / unsafe names (anything outside [a-zA-Z0-9_-]).
 *   - Throws if the source directory doesn't exist (lets the route
 *     return a 404 cleanly).
 *   - Empty / missing files are SKIPPED, not copied as empty strings —
 *     we don't want to blank the live persona by mistake.
 */
export function selectPersonality(rawName) {
  const name = _safeName(rawName);
  if (!name) throw new Error("personality name required");
  const src = path.join(SOURCE_DIR, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    const e = new Error(`personality not found: ${name}`);
    e.code = "ENOENT";
    throw e;
  }
  const destDir = _personaDir();
  fs.mkdirSync(destDir, { recursive: true, mode: 0o700 });

  const copied = [];
  const skipped = [];
  for (const f of FILES) {
    const sp = path.join(src, f);
    if (!fs.existsSync(sp)) { skipped.push(f); continue; }
    let content = "";
    try { content = fs.readFileSync(sp, "utf8"); } catch { skipped.push(f); continue; }
    if (!content.trim()) { skipped.push(f); continue; }
    const dp = path.join(destDir, f);
    fs.writeFileSync(dp, content, { mode: 0o600 });
    copied.push(f);
  }
  return { name, copied, skipped, destDir };
}

export const _CONSTANTS = { SOURCE_DIR, FILES };
