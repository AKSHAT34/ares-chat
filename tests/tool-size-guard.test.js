// Phase RP1-B4 — server-side tool-input size guard.
//
// Drives McpHub.callTool() against a stub MCP client to assert that
// oversized inputs are rejected BEFORE dispatch and that the per-tool
// override map allows legitimate large payloads through.

import { describe, it, expect, beforeEach } from "vitest";
import { McpHub } from "../lib/mcp-client.js";

// Build a hub with one running stub server registered. The server
// advertises a single tool whose schema is permissive (any object
// accepted) so the size guard is the only thing standing in the way
// of dispatch. We track every dispatched call to assert non-dispatch
// on rejection.
function makeHub() {
  const hub = new McpHub({ catalog: {}, log: () => {} });
  const dispatched = [];
  const stubClient = {
    callTool: async ({ name, arguments: args }) => {
      dispatched.push({ name, args });
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
  hub.state.set("stub", {
    state: "running",
    client: stubClient,
    process: null,
    tools: [{
      toolName: "echo",
      input_schema: { type: "object", properties: {}, additionalProperties: true },
    }],
    breaker: { failures: 0, openUntil: 0 },
    activatedAt: Date.now(),
  });
  // Also register the override-map tool for the override test.
  hub.state.set("email-mcp", {
    state: "running",
    client: stubClient,
    process: null,
    tools: [{
      toolName: "email_draft",
      input_schema: { type: "object", properties: {}, additionalProperties: true },
    }],
    breaker: { failures: 0, openUntil: 0 },
    activatedAt: Date.now(),
  });
  return { hub, dispatched };
}

describe("McpHub.callTool — RP1-B4 size guard", () => {
  let hub, dispatched;
  beforeEach(() => {
    ({ hub, dispatched } = makeHub());
  });

  it("rejects a 5000-char string field with isError + sentinel + no dispatch", async () => {
    const big = "x".repeat(5000);
    const res = await hub.callTool("stub__echo", { payload: big });
    expect(res.isError).toBe(true);
    expect(res._aresOversizedToolInput).toBe(true);
    expect(res.content[0].text).toMatch(/Tool input too large/);
    expect(dispatched.length).toBe(0);
  });

  it("allows exactly the cap size", async () => {
    // JSON-stringified `{"payload":"…"}` is 14 chars overhead → tune
    // the inner string to land at exactly 4096.
    const overhead = JSON.stringify({ payload: "" }).length; // 14
    const inner = "y".repeat(4096 - overhead);
    expect(JSON.stringify({ payload: inner }).length).toBe(4096);
    const res = await hub.callTool("stub__echo", { payload: inner });
    expect(res.isError).toBeFalsy();
    expect(dispatched.length).toBe(1);
  });

  it("rejects cap+1", async () => {
    const overhead = JSON.stringify({ payload: "" }).length;
    const inner = "z".repeat(4096 - overhead + 1);
    expect(JSON.stringify({ payload: inner }).length).toBe(4097);
    const res = await hub.callTool("stub__echo", { payload: inner });
    expect(res.isError).toBe(true);
    expect(dispatched.length).toBe(0);
  });

  it("rejects deeply nested objects whose serialized form exceeds the cap", async () => {
    // Construct a nested object with many keys until JSON.stringify > cap.
    const big = {};
    for (let i = 0; i < 600; i++) big[`k${i}`] = "abcdefghij"; // 600 × ~16 chars
    expect(JSON.stringify(big).length).toBeGreaterThan(4096);
    const res = await hub.callTool("stub__echo", big);
    expect(res.isError).toBe(true);
    expect(res._aresOversizedToolInput).toBe(true);
    expect(dispatched.length).toBe(0);
  });

  it("a subsequent normal-sized call to the same tool succeeds (no sticky state)", async () => {
    await hub.callTool("stub__echo", { payload: "x".repeat(5000) }); // rejected
    expect(dispatched.length).toBe(0);
    const res = await hub.callTool("stub__echo", { payload: "small" });
    expect(res.isError).toBeFalsy();
    expect(dispatched.length).toBe(1);
  });

  it("per-tool override allows email_draft up to 16K", async () => {
    const overhead = JSON.stringify({ body: "" }).length;
    const inner = "e".repeat(8000 - overhead); // well under the 16K override
    const res = await hub.callTool("email-mcp__email_draft", { body: inner });
    expect(res.isError).toBeFalsy();
    expect(dispatched.length).toBe(1);
  });

  it("per-tool override still rejects when over its own cap", async () => {
    const inner = "f".repeat(20000); // > 16K override
    const res = await hub.callTool("email-mcp__email_draft", { body: inner });
    expect(res.isError).toBe(true);
    expect(dispatched.length).toBe(0);
  });
});
