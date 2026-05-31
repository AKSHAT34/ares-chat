// Q-pass-4 (E) — personality presets.
//
// Exercises lib/personalities.js list/select. We cannot easily redirect
// the source dir (~/.kiro/personalities) without an env override, so the
// test temporarily renames any existing dir aside, drops fixtures in a
// fresh one, and restores afterwards. The destination dir is overridden
// via ARES_PERSONA_DIR so we don't touch the user's live ~/.ares/.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MOD = path.join(__dirname, "..", "lib", "personalities.js");
const RELOAD_MOD = path.join(__dirname, "..", "lib", "system-prompt-reload.js");

const SOURCE_DIR = path.join(os.homedir(), ".kiro", "personalities");

function _backupDir(p) {
  if (!fs.existsSync(p)) return null;
  const bak = `${p}.test-bak.${process.pid}.${Date.now()}`;
  fs.renameSync(p, bak);
  return bak;
}
function _restoreDir(p, bak) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  if (bak) {
    try { fs.renameSync(bak, p); } catch {}
  }
}

describe("Q-pass-4 (E) · personalities list + select", () => {
  let sourceBak = null;
  let destDir;
  let priorEnv;

  beforeEach(() => {
    sourceBak = _backupDir(SOURCE_DIR);
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    // Seed two personalities + a stray file that should be ignored.
    const calm = path.join(SOURCE_DIR, "calm");
    fs.mkdirSync(calm, { recursive: true });
    fs.writeFileSync(path.join(calm, "SOUL.md"), "# Calm Soul\n\nGentle and patient.\n");
    fs.writeFileSync(path.join(calm, "USER.md"), "# User\n");
    fs.writeFileSync(path.join(calm, "MEMORY.md"), "# Notes\n");

    const sharp = path.join(SOURCE_DIR, "sharp");
    fs.mkdirSync(sharp, { recursive: true });
    fs.writeFileSync(path.join(sharp, "SOUL.md"), "# Sharp Soul\n\nDirect, no preamble.\n");
    // Sharp has SOUL but no USER / MEMORY — partial preset case.

    fs.writeFileSync(path.join(SOURCE_DIR, "stray.txt"), "not a personality");

    destDir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-pers-dst-"));
    priorEnv = process.env.ARES_PERSONA_DIR;
    process.env.ARES_PERSONA_DIR = destDir;
  });

  afterEach(() => {
    if (priorEnv === undefined) delete process.env.ARES_PERSONA_DIR;
    else process.env.ARES_PERSONA_DIR = priorEnv;
    try { fs.rmSync(destDir, { recursive: true, force: true }); } catch {}
    _restoreDir(SOURCE_DIR, sourceBak);
  });

  it("lists known personalities in sorted order, ignoring stray files", async () => {
    const m = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const r = m.listPersonalities();
    expect(r.length).toBe(2);
    expect(r[0].name).toBe("calm");
    expect(r[1].name).toBe("sharp");
    expect(r[0].hasSoul).toBe(true);
    expect(r[0].hasUser).toBe(true);
    expect(r[0].hasMemory).toBe(true);
    expect(r[1].hasSoul).toBe(true);
    expect(r[1].hasUser).toBe(false);
    expect(r[1].hasMemory).toBe(false);
  });

  it("selectPersonality copies all three files into the persona dir", async () => {
    const m = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const r = m.selectPersonality("calm");
    expect(r.name).toBe("calm");
    expect(r.copied.sort()).toEqual(["MEMORY.md", "SOUL.md", "USER.md"]);
    expect(r.skipped.length).toBe(0);
    const soul = fs.readFileSync(path.join(destDir, "SOUL.md"), "utf8");
    expect(soul).toMatch(/Gentle and patient/);
  });

  it("selectPersonality skips missing source files instead of writing empty", async () => {
    const m = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    // Pre-seed the destination with non-empty USER/MEMORY so we can
    // assert they are NOT clobbered by the partial preset.
    fs.writeFileSync(path.join(destDir, "USER.md"), "# User pre-existing\n");
    fs.writeFileSync(path.join(destDir, "MEMORY.md"), "# Notes pre-existing\n");

    const r = m.selectPersonality("sharp");
    expect(r.copied).toEqual(["SOUL.md"]);
    expect(r.skipped.sort()).toEqual(["MEMORY.md", "USER.md"]);
    // Pre-existing files survive untouched.
    expect(fs.readFileSync(path.join(destDir, "USER.md"), "utf8")).toMatch(/pre-existing/);
    expect(fs.readFileSync(path.join(destDir, "MEMORY.md"), "utf8")).toMatch(/pre-existing/);
    // SOUL was overwritten with the new content.
    expect(fs.readFileSync(path.join(destDir, "SOUL.md"), "utf8")).toMatch(/Direct, no preamble/);
  });

  it("selectPersonality throws ENOENT for an unknown name", async () => {
    const m = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    expect(() => m.selectPersonality("does-not-exist")).toThrow(/not found/);
  });

  it("selecting a personality + reload makes the new SOUL visible in the prompt", async () => {
    const m = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const reloadMod = await import(`${RELOAD_MOD}?t=${Date.now()}-${Math.random()}`);
    m.selectPersonality("calm");
    const r = await reloadMod.reloadSystemPrompt({
      sessions: new Map([["S1", {}]]),
      hub: { listServers: () => "" },
      workspaceRoot: path.join(__dirname, ".."),
    });
    expect(r.prompt).toMatch(/Gentle and patient/);
  });

  it("rejects empty / unsafe names", async () => {
    const m = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    expect(() => m.selectPersonality("")).toThrow(/required/);
    expect(() => m.selectPersonality("../../etc/passwd")).toThrow();
  });
});
