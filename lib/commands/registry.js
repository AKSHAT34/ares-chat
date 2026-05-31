// Phase U13 — slash-command registry.
//
// Single source of truth for the / commands every frontend honours
// (browser, compact panel, CLI TUI). Each command has:
//   - name           the slash trigger (without the leading /)
//   - description    1-line help text
//   - args           free-form usage hint, never parsed here
//   - scope          which frontends can run it
//   - serverSide     true → POST /api/commands/run handles it
//                    false → frontend-local (e.g. /reset clears the
//                    UI's transcript, no server call)
//
// `serverSide:true` commands are wired to handlers in this module.
// `serverSide:false` commands are stubs whose handler returns a
// "frontend should handle this" marker; the frontend's parser shortcuts
// before posting to the server, so a misrouted call gets a clear hint.
//
// /personality — special-cased: swaps ~/.ares/SOUL.md to a personality
// file at ~/.ares/personalities/<name>.md (creating the symlink-style
// content copy). Restart ares-chat to apply (system prompt is built
// once at boot in U12). Future U17 / U21 work can hot-reload.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Resolve paths lazily on every call so test redirects via
// ARES_PERSONA_DIR work even though the module loaded before they were
// set. (Same pattern as lib/persona.js.)
function aresDir() {
  return process.env.ARES_PERSONA_DIR || path.join(os.homedir(), ".ares");
}
function personalitiesDir() { return path.join(aresDir(), "personalities"); }
function soulPath() { return path.join(aresDir(), "SOUL.md"); }

// ─── command catalog ───
export const COMMANDS = [
  { name: "new",         description: "Start a new chat (clears the active transcript).",                   args: "", scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "reset",       description: "Clear the current chat without creating a new session id.",          args: "", scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "model",       description: "Switch Bedrock model. Pass 'haiku', 'sonnet', 'opus', or a full id.", args: "<id|tier>", scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "personality", description: "Switch persona. Replaces ~/.ares/SOUL.md with the chosen file.",     args: "<name>", scope: ["browser", "compact", "cli"], serverSide: true },
  { name: "personalities", description: "List available personalities under ~/.ares/personalities/.",       args: "",       scope: ["browser", "compact", "cli"], serverSide: true },
  { name: "skills",      description: "List skills the agent knows about.",                                  args: "",       scope: ["browser", "compact", "cli"], serverSide: true },
  { name: "compress",    description: "Force-compress the current transcript before the next turn.",        args: "",       scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "usage",       description: "Show prompt-cache + token-budget snapshot.",                          args: "",       scope: ["browser", "compact", "cli"], serverSide: true },
  { name: "retry",       description: "Re-run the last user turn (resends the last user message).",         args: "",       scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "undo",        description: "Drop the last assistant turn from the visible transcript.",          args: "",       scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "stop",        description: "Stop the in-flight run.",                                              args: "",       scope: ["browser", "compact", "cli"], serverSide: false },
  { name: "platforms",   description: "List per-platform tool toggles (browser/compact/cli/slack/outlook).",  args: "",       scope: ["browser", "compact", "cli"], serverSide: true },
  { name: "help",        description: "List all slash commands.",                                            args: "",       scope: ["browser", "compact", "cli"], serverSide: false },
];

const BY_NAME = new Map(COMMANDS.map((c) => [c.name, c]));

export function listCommands(scope = null) {
  if (!scope) return COMMANDS.slice();
  return COMMANDS.filter((c) => c.scope.includes(scope));
}

export function getCommand(name) {
  return BY_NAME.get((name || "").replace(/^\//, "").trim()) || null;
}

// ─── /personality + /personalities handlers ───

function ensurePersonalitiesDir() {
  fs.mkdirSync(personalitiesDir(), { recursive: true, mode: 0o700 });
}

export function listPersonalities() {
  ensurePersonalitiesDir();
  const dir = personalitiesDir();
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    out.push({
      name: f.replace(/\.md$/, ""),
      path: full,
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
    });
  }
  return out;
}

/**
 * Swap the current persona by replacing ~/.ares/SOUL.md with the named
 * personality file (copy, not symlink — keeps the file readable when
 * the source is later deleted, and the U12 reader is content-based).
 *
 * Returns { ok, name, path, prevSoulBackedUpAt? }.
 *
 * Backs up the previous SOUL.md to ~/.ares/SOUL.md.bak.<timestamp> on
 * every swap so the user can roll back without losing edits.
 */
export function setPersonality(name) {
  if (!name || typeof name !== "string") {
    throw new Error("setPersonality: name is required");
  }
  ensurePersonalitiesDir();
  const safe = name.replace(/[^\w-]/g, "");
  if (!safe) throw new Error(`invalid personality name: ${name}`);
  const src = path.join(personalitiesDir(), `${safe}.md`);
  if (!fs.existsSync(src)) {
    throw new Error(`personality "${safe}" not found at ${src}`);
  }
  const dest = soulPath();
  let prevSoulBackedUpAt = null;
  try {
    if (fs.existsSync(dest)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const bak = `${dest}.bak.${stamp}`;
      fs.copyFileSync(dest, bak);
      prevSoulBackedUpAt = bak;
    }
  } catch (e) {
    console.warn(`[commands] could not back up previous SOUL.md: ${e.message}`);
  }
  fs.copyFileSync(src, dest);
  try { fs.chmodSync(dest, 0o600); } catch {}
  return { ok: true, name: safe, path: src, prevSoulBackedUpAt, requiresRestart: true };
}
