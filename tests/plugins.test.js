// Phase U14 — plugin loader tests.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let TMP_HOME;
let prevHome;

beforeEach(() => {
  prevHome = process.env.HOME;
  TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ares-plugins-"));
  process.env.HOME = TMP_HOME;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch {}
});

function writePlugin(name, body) {
  const dir = path.join(TMP_HOME, ".ares", "plugins");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.js`), body);
}

describe("plugins — discovery + load", () => {
  it("returns empty list when no plugins dir exists", async () => {
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    expect(reg.plugins).toEqual([]);
  });

  it("loads a single-file plugin and detects its hooks", async () => {
    writePlugin("count-tools", `
      export const metadata = { name: "count-tools", version: "0.1" };
      let calls = 0;
      export function postToolCall() { calls++; }
      export function totalCalls() { return calls; }
    `);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    expect(reg.plugins).toHaveLength(1);
    expect(reg.plugins[0].id).toBe("count-tools");
    expect(reg.plugins[0].hooks.postToolCall).toBeDefined();
    expect(reg.plugins[0].hooks.preToolCall).toBeUndefined();
    expect(reg.plugins[0].metadata.name).toBe("count-tools");
  });

  it("survives a plugin that throws on import", async () => {
    writePlugin("good", `export function preTurn() {}`);
    writePlugin("broken", `throw new Error("bad import");`);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    // Only the good one loads.
    const ids = reg.plugins.map((p) => p.id);
    expect(ids).toContain("good");
    expect(ids).not.toContain("broken");
  });

  it("ignores hidden files and directories starting with _", async () => {
    writePlugin(".hidden", `export function preTurn() {}`);
    writePlugin("_disabled", `export function preTurn() {}`);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    expect(reg.plugins).toHaveLength(0);
  });

  it("discovers a directory plugin via index.js", async () => {
    const dir = path.join(TMP_HOME, ".ares", "plugins", "complex");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.js"), `export function postTurn() {}`);
    fs.writeFileSync(path.join(dir, "helper.js"), `export const x = 1;`);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    expect(reg.plugins).toHaveLength(1);
    expect(reg.plugins[0].id).toBe("complex");
    expect(reg.plugins[0].hooks.postTurn).toBeDefined();
  });
});

describe("plugins — fire", () => {
  it("calls every plugin's hook when present", async () => {
    writePlugin("a", `let n = 0; export function preTurn() { n++; } export function count() { return n; }`);
    writePlugin("b", `let n = 0; export function preTurn() { n++; }`);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    const r = await reg.fire("preTurn", { messages: [], sessionId: "s1" });
    expect(r.fired).toBe(2);
  });

  it("preToolCall returning false vetoes the call", async () => {
    writePlugin("guard", `
      export function preToolCall(ctx) {
        if (ctx.toolName === "shell-agent__shell_exec") return false;
        return true;
      }
    `);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    const r = await reg.fire("preToolCall", { toolName: "shell-agent__shell_exec", args: { command: "rm -rf /" } });
    expect(r.vetoed).toBe(true);
    expect(r.vetoBy).toBe("guard");
  });

  it("preToolCall returning {veto:true, reason} carries the reason", async () => {
    writePlugin("policy", `
      export function preToolCall() {
        return { veto: true, reason: "policy-locked" };
      }
    `);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    const r = await reg.fire("preToolCall", { toolName: "x" });
    expect(r.vetoed).toBe(true);
    expect(r.reason).toBe("policy-locked");
  });

  it("plugin throws are caught and recorded, never propagate", async () => {
    writePlugin("bad-hook", `export function postTurn() { throw new Error("oh no"); }`);
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await reg.load({ workspaceRoot: undefined, log: () => {} });
    const r = await reg.fire("postTurn", { messages: [] });
    expect(r.fired).toBe(0); // increment only on success
    expect(reg.plugins[0].errors).toHaveLength(1);
    expect(reg.plugins[0].errors[0].message).toContain("oh no");
  });

  it("rejects unknown hook names", async () => {
    const m = await import("../lib/plugins/loader.js");
    const reg = new m.PluginRegistry();
    await expect(reg.fire("notARealHook", {})).rejects.toThrow(/unknown hook/);
  });
});

describe("plugins — registry singleton", () => {
  it("getPluginRegistry returns the same instance across calls", async () => {
    const m = await import("../lib/plugins/loader.js");
    m._resetForTests();
    const a = m.getPluginRegistry();
    const b = m.getPluginRegistry();
    expect(a).toBe(b);
  });
});
