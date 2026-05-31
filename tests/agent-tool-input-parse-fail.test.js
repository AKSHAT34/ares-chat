// Phase-3 audit · B-4 · partial-JSON tool_use input must surface a warning.
//
// Pre-fix: agent.js silently fell back to `input = {}` when the
// content_block_stop arrived for a tool_use whose input_json_delta stream
// produced unparseable JSON. No log, no event — the user just saw the
// tool fire with empty args.
//
// Post-fix: still falls back to {} (so the dispatch isn't blocked) but
// also yields an `agent_warning` event with kind=tool_input_parse_failed.

import { describe, it, expect } from "vitest";
import { Agent } from "../lib/agent.js";

function makeHub() {
  return {
    getClaudeTools: () => [{
      name: "fake__tool",
      description: "x",
      input_schema: { type: "object", properties: {} },
    }],
    getActiveServers: () => [],
    callTool: async () => ({ isError: false, content: [{ type: "text", text: "ok" }] }),
  };
}

// Stream a tool_use whose input_json_delta is broken (open brace, no close).
function brokenToolUseEvents() {
  return [
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tu1", name: "fake__tool", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"foo": "ba' } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "tool_use" } },
    { type: "message_stop" },
  ];
}

function endTurnEvents() {
  return [
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "done" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" } },
    { type: "message_stop" },
  ];
}

function makeBedrock(script) {
  let i = 0;
  return {
    profile: null,
    async *stream() {
      const evs = script[i] || script[script.length - 1];
      i++;
      for (const ev of evs) yield ev;
    },
    invoke: async () => ({ content: [{ type: "text", text: "" }], stop_reason: "end_turn" }),
  };
}

describe("Phase-3 B-4 · tool_use input parse-fail telemetry", () => {
  it("yields agent_warning with kind=tool_input_parse_failed when JSON is broken", async () => {
    const bedrock = makeBedrock([brokenToolUseEvents(), endTurnEvents()]);
    const agent = new Agent({ bedrock, hub: makeHub(), systemPrompt: "x", log: () => {} });
    const events = [];
    for await (const ev of agent.run([{ role: "user", content: "go" }], "sess-test")) {
      events.push(ev);
      if (ev.type === "done" || ev.type === "error" || ev.type === "premature_stop") break;
    }
    const warn = events.find((e) => e.type === "agent_warning" && e.kind === "tool_input_parse_failed");
    expect(warn).toBeTruthy();
    expect(warn.toolName).toBe("fake__tool");
    expect(typeof warn.error).toBe("string");
    expect(warn.partialJsonLength).toBeGreaterThan(0);
  }, 30_000);
});
