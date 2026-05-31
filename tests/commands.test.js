// Phase U13 — slash-command registry + personality switcher tests.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let TMP;
let prevDir;

beforeEach(() => {
  prevDir = process.env.ARES_PERSONA_DIR;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ares-cmds-"));
  process.env.ARES_PERSONA_DIR = TMP;
});

afterEach(() => {
  if (prevDir === undefined) delete process.env.ARES_PERSONA_DIR;
  else process.env.ARES_PERSONA_DIR = prevDir;
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
});

// Fresh-import the registry module each test so it picks up the env var.
async function loadRegistry() {
  return await import("../lib/commands/registry.js");
}

describe("commands — registry", () => {
  it("exports the 13 standard commands", async () => {
    const m = await loadRegistry();
    const required = ["new", "reset", "model", "personality", "personalities", "skills", "compress", "usage", "retry", "undo", "stop", "platforms", "help"];
    for (const r of required) {
      expect(m.COMMANDS.find((c) => c.name === r)).toBeTruthy();
    }
  });

  it("listCommands(scope) filters by frontend", async () => {
    const m = await loadRegistry();
    const browser = m.listCommands("browser");
    expect(browser.length).toBeGreaterThan(0);
    expect(browser.every((c) => c.scope.includes("browser"))).toBe(true);
  });

  it("getCommand strips a leading slash", async () => {
    const m = await loadRegistry();
    expect(m.getCommand("/help")?.name).toBe("help");
    expect(m.getCommand("model")?.name).toBe("model");
    expect(m.getCommand("/does-not-exist")).toBeNull();
  });
});

describe("commands — personalities", () => {
  it("listPersonalities returns empty array on a fresh dir", async () => {
    const m = await loadRegistry();
    expect(m.listPersonalities()).toEqual([]);
  });

  it("listPersonalities ignores non-.md files", async () => {
    fs.mkdirSync(path.join(TMP, "personalities"), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(TMP, "personalities", "terse.md"), "# terse\nbe brief");
    fs.writeFileSync(path.join(TMP, "personalities", "README"), "skip me");
    const m = await loadRegistry();
    const list = m.listPersonalities();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("terse");
  });

  it("setPersonality copies the chosen file to SOUL.md and backs up the old one", async () => {
    fs.writeFileSync(path.join(TMP, "SOUL.md"), "# original soul");
    fs.mkdirSync(path.join(TMP, "personalities"), { recursive: true });
    fs.writeFileSync(path.join(TMP, "personalities", "terse.md"), "# terse soul\nbe brief");
    const m = await loadRegistry();
    const r = m.setPersonality("terse");
    expect(r.ok).toBe(true);
    expect(r.name).toBe("terse");
    expect(r.requiresRestart).toBe(true);
    expect(fs.readFileSync(path.join(TMP, "SOUL.md"), "utf8")).toContain("terse soul");
    // Backup exists
    expect(r.prevSoulBackedUpAt).toBeTruthy();
    expect(fs.existsSync(r.prevSoulBackedUpAt)).toBe(true);
    expect(fs.readFileSync(r.prevSoulBackedUpAt, "utf8")).toContain("original soul");
  });

  it("setPersonality throws on an unknown name", async () => {
    fs.mkdirSync(path.join(TMP, "personalities"), { recursive: true });
    const m = await loadRegistry();
    expect(() => m.setPersonality("ghost")).toThrow(/not found/);
  });

  it("setPersonality sanitises the name (no path-traversal)", async () => {
    fs.mkdirSync(path.join(TMP, "personalities"), { recursive: true });
    const m = await loadRegistry();
    // "../../etc" sanitises to "etc" — which doesn't exist in the dir, so error.
    expect(() => m.setPersonality("../../etc/passwd")).toThrow(/not found/);
  });

  it("setPersonality preserves SOUL.md mode 0600", async () => {
    fs.writeFileSync(path.join(TMP, "SOUL.md"), "old", { mode: 0o600 });
    fs.mkdirSync(path.join(TMP, "personalities"), { recursive: true });
    fs.writeFileSync(path.join(TMP, "personalities", "x.md"), "# x");
    const m = await loadRegistry();
    m.setPersonality("x");
    const stat = fs.statSync(path.join(TMP, "SOUL.md"));
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
