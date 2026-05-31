// Phase-3 audit · B-13 · McpHub.close() must tear down every running child.
//
// Pre-fix bug: server.js gracefulShutdown awaited hub.close() but McpHub had
// no close method → TypeError → catch logs warning → process.exit(0) before
// child stdio teardown → orphaned MCP children adopted by init.

import { describe, it, expect } from "vitest";
import { McpHub } from "../lib/mcp-client.js";

describe("Phase-3 B-13 · McpHub.close()", () => {
  it("exists as an async method", () => {
    const hub = new McpHub({ catalog: {}, log: () => {} });
    expect(typeof hub.close).toBe("function");
    const ret = hub.close();
    expect(ret).toBeInstanceOf(Promise);
    return ret; // resolves cleanly even with no servers
  });

  it("returns { closed: 0 } when no servers are running", async () => {
    const hub = new McpHub({ catalog: {}, log: () => {} });
    const r = await hub.close();
    expect(r).toEqual({ closed: 0 });
  });

  it("kills running servers (including tier-1) and reports the count", async () => {
    const hub = new McpHub({ catalog: {}, log: () => {} });
    const closed = [];
    // Stub two running servers. tier-1 server cannot be deactivated via
    // public API but close() must still tear it down.
    hub.alwaysActive = new Set(["t1"]);
    hub.state = new Map([
      ["t1", {
        state: "running",
        client: { close: async () => { closed.push("t1"); } },
        tools: [{ name: "x" }],
      }],
      ["t2", {
        state: "running",
        client: { close: async () => { closed.push("t2"); } },
        tools: [],
      }],
      ["idle", {
        state: "idle",
        client: null,
        tools: [],
      }],
    ]);
    const r = await hub.close();
    expect(r).toEqual({ closed: 2 });
    expect(closed.sort()).toEqual(["t1", "t2"]);
    expect(hub.state.get("t1").state).toBe("idle");
    expect(hub.state.get("t2").state).toBe("idle");
  });

  it("absorbs failures during kill so other servers still close", async () => {
    const hub = new McpHub({ catalog: {}, log: () => {} });
    const closed = [];
    hub.state = new Map([
      ["a", { state: "running", client: { close: async () => { throw new Error("boom"); } }, tools: [] }],
      ["b", { state: "running", client: { close: async () => { closed.push("b"); } }, tools: [] }],
    ]);
    const r = await hub.close();
    // a's transport throw is caught inside _kill, so _kill itself resolves.
    expect(r.closed).toBe(2);
    expect(closed).toContain("b");
  });
});
