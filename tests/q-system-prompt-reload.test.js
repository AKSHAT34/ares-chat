// Q-pass-4 (E) — system-prompt hot-reload.
//
// Exercises lib/system-prompt-reload.js. We point the persona dir at a
// tmp directory via ARES_PERSONA_DIR (lib/persona.js honours it), edit
// SOUL.md between two reload calls, and verify the second reload
// reflects the new content.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MOD = path.join(ROOT, "lib", "system-prompt-reload.js");

describe("Q-pass-4 (E) · system-prompt hot-reload", () => {
  let tmpDir;
  let priorEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-reload-"));
    priorEnv = process.env.ARES_PERSONA_DIR;
    process.env.ARES_PERSONA_DIR = tmpDir;
  });

  afterEach(() => {
    if (priorEnv === undefined) delete process.env.ARES_PERSONA_DIR;
    else process.env.ARES_PERSONA_DIR = priorEnv;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("reloads with the freshly-built prompt and reports the count", async () => {
    fs.writeFileSync(path.join(tmpDir, "SOUL.md"), "# Soul v1\n\nVoice is calm.\n");
    fs.writeFileSync(path.join(tmpDir, "USER.md"), "# User\n");
    fs.writeFileSync(path.join(tmpDir, "MEMORY.md"), "# Notes\n");

    const { reloadSystemPrompt } = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const sessions = new Map([["S1", {}], ["S2", {}]]);
    const hub = { listServers: () => "" };
    const r = await reloadSystemPrompt({
      sessions,
      hub,
      workspaceRoot: ROOT,
    });
    expect(r.reloaded).toBe(2);
    expect(r.errors.length).toBe(0);
    expect(r.length).toBeGreaterThan(0);
    expect(r.prompt).toMatch(/Voice is calm/);
  });

  it("picks up edits to SOUL.md without a server restart", async () => {
    fs.writeFileSync(path.join(tmpDir, "SOUL.md"), "# Soul v1\n\nFIRST_VERSION_TOKEN\n");
    const { reloadSystemPrompt } = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const hub = { listServers: () => "" };

    const a = await reloadSystemPrompt({ sessions: new Map(), hub, workspaceRoot: ROOT });
    expect(a.prompt).toMatch(/FIRST_VERSION_TOKEN/);

    // Simulate the user editing SOUL.md mid-flight.
    fs.writeFileSync(path.join(tmpDir, "SOUL.md"), "# Soul v2\n\nSECOND_VERSION_TOKEN\n");
    const b = await reloadSystemPrompt({ sessions: new Map(), hub, workspaceRoot: ROOT });
    expect(b.prompt).toMatch(/SECOND_VERSION_TOKEN/);
    expect(b.prompt).not.toMatch(/FIRST_VERSION_TOKEN/);
  });

  it("only reloads the requested sessionIds when provided", async () => {
    fs.writeFileSync(path.join(tmpDir, "SOUL.md"), "# Soul\n");
    const { reloadSystemPrompt } = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const sessions = new Map([["S1", {}], ["S2", {}], ["S3", {}]]);
    const hub = { listServers: () => "" };

    const seen = [];
    const r = await reloadSystemPrompt({
      sessions, hub, workspaceRoot: ROOT,
      sessionIds: ["S1", "S3"],
      applyPrompt: (sid) => seen.push(sid),
    });
    expect(r.reloaded).toBe(2);
    expect(seen.sort()).toEqual(["S1", "S3"]);
  });

  it("returns errors[] entries when applyPrompt throws", async () => {
    fs.writeFileSync(path.join(tmpDir, "SOUL.md"), "# Soul\n");
    const { reloadSystemPrompt } = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    const sessions = new Map([["good", {}], ["bad", {}]]);
    const r = await reloadSystemPrompt({
      sessions,
      hub: { listServers: () => "" },
      workspaceRoot: ROOT,
      applyPrompt: (sid) => { if (sid === "bad") throw new Error("boom"); },
    });
    expect(r.reloaded).toBe(1);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0].sessionId).toBe("bad");
    expect(r.errors[0].error).toMatch(/boom/);
  });
});
