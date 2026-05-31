// Phase U05 — ares_delegate_subagent meta-tool tests.
//
// Covers:
//   1. Tool is registered in META_TOOLS and visible via getClaudeTools().
//   2. setOrchestratorFactory plumbing works.
//   3. Calling the meta-tool without a factory registered returns isError.
//   4. Empty / missing prompt returns isError.
//   5. Factory result is consumed and synthesised text + tool-call summary
//      come back as a single tool_result content block.
//   6. MCP allowlist activates + deactivates around the subtask.
//
// We use a fake McpHub built directly via `new McpHub(...)` and never call
// .start() — keeps tests offline. The hub already exposes _callMetaTool
// because callTool dispatches to it; we go through callTool to exercise
// the full path.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpHub } from "../lib/mcp-client.js";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const FAKE_MCP_JSON = path.join(os.tmpdir(), `ares-test-mcp-${process.pid}.json`);

function makeHub() {
  // Build a hub but don't call .start() so we don't spawn real MCPs. We
  // populate the bare minimum state by hand.
  writeFileSync(FAKE_MCP_JSON, JSON.stringify({
    mcpServers: {
      // One fake on-demand MCP so the allowlist path has a known target.
      "fake-mcp": { command: "/nonexistent/binary", args: [] },
    },
  }));
  const hub = new McpHub({ mcpJsonPath: FAKE_MCP_JSON, log: () => {}, alwaysActive: new Set() });
  // Hand-populate spec + state to mimic what start() would do, minus
  // actually spawning anything.
  hub.specs.set("fake-mcp", { command: "/nonexistent/binary", args: [] });
  hub.state.set("fake-mcp", { tools: [], state: "idle", breaker: { fails: 0, openedAt: 0 } });
  return hub;
}

beforeEach(() => {
  if (existsSync(FAKE_MCP_JSON)) {
    try { unlinkSync(FAKE_MCP_JSON); } catch {}
  }
});

describe("ares_delegate_subagent — tool registration", () => {
  it("appears in getClaudeTools() with the right schema shape", () => {
    const hub = makeHub();
    const tools = hub.getClaudeTools();
    const t = tools.find((x) => x.name === "ares_delegate_subagent");
    expect(t).toBeTruthy();
    expect(t.input_schema.type).toBe("object");
    expect(Object.keys(t.input_schema.properties)).toEqual(
      expect.arrayContaining(["prompt", "model", "mcps"])
    );
    expect(t.input_schema.required).toContain("prompt");
    // Description must mention the sub-task semantics so the agent
    // routing-ladder copy stays in sync with the tool description.
    expect(t.description).toMatch(/sub.?agent/i);
    expect(t.description).toMatch(/context window/i);
  });
});

describe("ares_delegate_subagent — orchestrator factory wiring", () => {
  it("returns isError when no factory is registered", async () => {
    const hub = makeHub();
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "x" });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/orchestrator factory not registered/);
  });

  it("setOrchestratorFactory accepts a function", () => {
    const hub = makeHub();
    expect(() => hub.setOrchestratorFactory(() => ({}))).not.toThrow();
  });

  it("setOrchestratorFactory(null) clears the registration", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({ async *run() { yield { type: "text_delta", text: "hi" }; } }));
    hub.setOrchestratorFactory(null);
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "x" });
    expect(out.isError).toBe(true);
  });

  it("setOrchestratorFactory(non-function) clears the registration", () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({}));
    hub.setOrchestratorFactory("not a function");
    expect(hub._orchestratorFactory).toBeNull();
  });
});

describe("ares_delegate_subagent — input validation", () => {
  it("returns isError when prompt is empty", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({ async *run() { yield { type: "text_delta", text: "x" }; } }));
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "" });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/non-empty `prompt`/);
  });

  it("returns isError when prompt is missing entirely", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({ async *run() { yield { type: "text_delta", text: "x" }; } }));
    const out = await hub.callTool("ares_delegate_subagent", {});
    expect(out.isError).toBe(true);
  });

  it("trims prompt whitespace before passing to orchestrator", async () => {
    const hub = makeHub();
    let seenPrompt = null;
    let seenMessages = null;
    hub.setOrchestratorFactory(() => ({
      async *run(messages, userMessage) {
        seenPrompt = userMessage;
        seenMessages = messages;
        yield { type: "text_delta", text: "ok" };
      },
    }));
    await hub.callTool("ares_delegate_subagent", { prompt: "  hello world  " });
    // Both the userMessage param and the synthetic message content must
    // see the trimmed value — that's what the model gets on the wire.
    expect(seenPrompt).toBe("hello world");
    expect(seenMessages?.[0]?.content?.[0]?.text).toBe("hello world");
  });
});

describe("ares_delegate_subagent — execution + result shape", () => {
  it("synthesises text from text_delta events and returns one tool_result block", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({
      async *run() {
        yield { type: "text_delta", text: "Hello " };
        yield { type: "text_delta", text: "world." };
      },
    }));
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "hi" });
    expect(out.isError).toBeUndefined();
    expect(out.content).toHaveLength(1);
    expect(out.content[0].text).toContain("Hello world.");
    expect(out.content[0].text).toMatch(/Subagent \(model=sonnet\) finished\./);
    expect(out.content[0].text).toMatch(/Tools used: none/);
  });

  it("collects tool_call names from subtask_event into the summary header", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({
      async *run() {
        yield { type: "subtask_event", id: "t1", event: { type: "tool_call", name: "shell-agent__shell_exec" } };
        yield { type: "subtask_event", id: "t1", event: { type: "tool_call", name: "filesystem-agent__fs_write" } };
        yield { type: "subtask_event", id: "t1", event: { type: "text_delta", text: "done" } };
      },
    }));
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "hi" });
    expect(out.content[0].text).toMatch(/shell-agent__shell_exec, filesystem-agent__fs_write/);
    expect(out.content[0].text).toMatch(/done/);
  });

  it("respects the `model` arg in the summary header", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({
      async *run() { yield { type: "text_delta", text: "x" }; },
    }));
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "hi", model: "opus" });
    expect(out.content[0].text).toMatch(/model=opus/);
  });

  it("returns isError when subagent emits an error event with no text", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({
      async *run() {
        yield { type: "error", error: "subagent crashed" };
      },
    }));
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "hi" });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/Subagent error: subagent crashed/);
  });

  it("returns partial result + note when subagent had error AND text", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => ({
      async *run() {
        yield { type: "text_delta", text: "got partway through " };
        yield { type: "subtask_event", id: "t1", event: { type: "error", error: "MCP timeout" } };
        yield { type: "text_delta", text: "before failing" };
      },
    }));
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "hi" });
    expect(out.isError).toBeUndefined();
    expect(out.content[0].text).toMatch(/partial error: MCP timeout/);
    expect(out.content[0].text).toMatch(/got partway through before failing/);
  });

  it("handles factory throwing synchronously without crashing the caller", async () => {
    const hub = makeHub();
    hub.setOrchestratorFactory(() => { throw new Error("factory blew up"); });
    const out = await hub.callTool("ares_delegate_subagent", { prompt: "hi" });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/factory threw: factory blew up/);
  });
});

describe("ares_delegate_subagent — MCP allowlist", () => {
  it("activates + pins listed MCPs and unpins (without deactivating) afterwards", async () => {
    const hub = makeHub();
    // Stub activate/deactivate so we don't need real spawn behaviour.
    const activateSpy = vi.fn(async (name) => ({ name, active: true, toolCount: 0 }));
    const deactivateSpy = vi.fn(async () => ({}));
    hub.activate = activateSpy;
    hub.deactivate = deactivateSpy;
    hub.setOrchestratorFactory(() => ({
      async *run() { yield { type: "text_delta", text: "ok" }; },
    }));
    await hub.callTool("ares_delegate_subagent", { prompt: "hi", mcps: ["fake-mcp"] });
    expect(activateSpy).toHaveBeenCalledWith("fake-mcp");
    // Keep-all-open policy (2026-05-29): the subagent no longer deactivates
    // its MCPs — every server is always-on and stays running.
    expect(deactivateSpy).not.toHaveBeenCalled();
    // Pin/unpin counters: net zero.
    expect(hub._pinnedMcps.has("fake-mcp")).toBe(false);
  });

  it("skips MCPs not in the catalog without activating", async () => {
    const hub = makeHub();
    const activateSpy = vi.fn(async () => ({ active: true }));
    hub.activate = activateSpy;
    hub.setOrchestratorFactory(() => ({
      async *run() { yield { type: "text_delta", text: "ok" }; },
    }));
    await hub.callTool("ares_delegate_subagent", { prompt: "hi", mcps: ["totally-fake-mcp"] });
    expect(activateSpy).not.toHaveBeenCalled();
  });

  it("releases the MCP pin (without deactivating) when the orchestrator throws mid-run", async () => {
    const hub = makeHub();
    const deactivateSpy = vi.fn(async () => ({}));
    hub.activate = vi.fn(async (name) => ({ name, active: true }));
    hub.deactivate = deactivateSpy;
    hub.setOrchestratorFactory(() => ({
      async *run() {
        yield { type: "text_delta", text: "starting" };
        throw new Error("orchestrator died");
      },
    }));
    await hub.callTool("ares_delegate_subagent", { prompt: "hi", mcps: ["fake-mcp"] });
    // Keep-all-open policy: the finally unpins but never deactivates, so a
    // throw can't leak a pin AND can't tear down an always-on server.
    expect(deactivateSpy).not.toHaveBeenCalled();
    expect(hub._pinnedMcps.has("fake-mcp")).toBe(false);
  });
});
