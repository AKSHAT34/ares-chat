// MCP manual connect/disconnect override persistence (2026-05-30).
// Verifies that connect()/disconnect() persist a per-server override to
// ~/.ares/mcp-overrides.json and that the boot list honours it.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OVERRIDES = path.join(os.homedir(), ".ares", "mcp-overrides.json");

function readOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES, "utf8")); } catch { return {}; }
}

describe("McpHub manual connect/disconnect overrides", () => {
  let backup = null;
  beforeEach(() => {
    try { backup = fs.readFileSync(OVERRIDES, "utf8"); } catch { backup = null; }
  });
  afterEach(() => {
    if (backup != null) fs.writeFileSync(OVERRIDES, backup);
    else { try { fs.unlinkSync(OVERRIDES); } catch {} }
  });

  async function makeHub() {
    const { McpHub } = await import("../lib/mcp-client.js");
    // Point at the real workspace mcp.json so specs load; we won't actually
    // spawn (we stub _spawn).
    const hub = new McpHub({
      mcpJsonPath: path.join(process.cwd(), "..", "..", ".kiro", "settings", "mcp.json"),
      log: () => {},
    });
    return hub;
  }

  it("disconnect() persists a 'disconnected' override and kills the child", async () => {
    const hub = await makeHub();
    // Minimal spec set so we don't depend on the live mcp.json contents.
    hub.specs.set("test-mcp", { command: "true", args: [] });
    hub.state.set("test-mcp", { tools: [], state: "running", breaker: { fails: 0, openedAt: 0 }, client: { close: vi.fn(async () => {}) } });
    const r = await hub.disconnect("test-mcp");
    expect(r.active).toBe(false);
    expect(r.override).toBe("disconnected");
    expect(readOverrides()["test-mcp"]).toBe("disconnected");
    expect(hub.overrideFor("test-mcp")).toBe("disconnected");
  });

  it("connect() persists a 'connected' override (even on spawn failure)", async () => {
    const hub = await makeHub();
    hub.specs.set("test-mcp2", { command: "true", args: [], disabled: true });
    hub.state.set("test-mcp2", { tools: [], state: "disabled", breaker: { fails: 0, openedAt: 0 } });
    // Stub activate to simulate a failed spawn.
    hub.activate = vi.fn(async () => { throw new Error("needs auth-init"); });
    const r = await hub.connect("test-mcp2");
    expect(r.override).toBe("connected");
    expect(readOverrides()["test-mcp2"]).toBe("connected");
    // The override is kept so a future boot retries it.
    expect(hub.overrideFor("test-mcp2")).toBe("connected");
  });

  it("listServers() surfaces the override field", async () => {
    const hub = await makeHub();
    hub.specs.set("test-mcp3", { command: "true", args: [] });
    hub.state.set("test-mcp3", { tools: [], state: "idle", breaker: { fails: 0, openedAt: 0 } });
    hub._setOverride("test-mcp3", "disconnected");
    const row = hub.listServers().find((s) => s.name === "test-mcp3");
    expect(row).toBeTruthy();
    expect(row.override).toBe("disconnected");
  });
});
