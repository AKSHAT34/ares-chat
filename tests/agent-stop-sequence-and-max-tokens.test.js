// Phase-3 audit · B-2 + B-3 ·
//   B-2: stop_sequence in mid-workflow must trigger the premature-stop nudge.
//   B-3: max_tokens stop must escalate the next iteration's max_tokens budget.
//
// Reuses the harness shape from agent-premature-stop.test.js. We stub the
// bedrock driver, drive Agent.run, and assert the visible behaviour.

import { describe, it, expect } from "vitest";
import { Agent } from "../lib/agent.js";

function makeHub() {
  return {
    getClaudeTools: () => [],
    getActiveServers: () => [],
    callTool: async () => ({ isError: true, content: [{ type: "text", text: "stub" }] }),
  };
}

function emptyStopWithReason(reason) {
  return [
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: reason } },
    { type: "message_stop" },
  ];
}

function makeBedrock(script, observed) {
  let nextIdx = 0;
  return {
    profile: null,
    async *stream(req) {
      observed.push({ max_tokens: req.max_tokens });
      const events = script[nextIdx] || script[script.length - 1];
      nextIdx++;
      for (const ev of events) yield ev;
    },
    invoke: async () => ({ content: [{ type: "text", text: "" }], stop_reason: "end_turn" }),
  };
}

describe("Phase-3 B-2 · stop_sequence triggers premature-stop recovery", () => {
  it("emits a nudge when the model stops on stop_sequence mid-workflow", async () => {
    const observed = [];
    const bedrock = makeBedrock([
      emptyStopWithReason("stop_sequence"),
      emptyStopWithReason("stop_sequence"),
      emptyStopWithReason("stop_sequence"),
      emptyStopWithReason("stop_sequence"),
    ], observed);
    const agent = new Agent({ bedrock, hub: makeHub(), systemPrompt: "x" });
    const messages = [
      { role: "user", content: "do the thing" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "fake__tool", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
    ];
    const events = [];
    for await (const ev of agent.run(messages, "sess-test")) {
      events.push(ev);
      if (ev.type === "premature_stop" || ev.type === "done" || ev.type === "error") break;
    }
    const stalled = events.filter((e) => e.type === "stalled" && e.reason === "premature-stop");
    expect(stalled.length).toBe(3);
    const last = events[events.length - 1];
    expect(last.type).toBe("premature_stop");
  }, 30_000);
});

describe("Phase-3 B-3 · max_tokens escalation ladder", () => {
  it("first iteration uses 16384, escalates to 24576 after a max_tokens stop", async () => {
    const observed = [];
    const bedrock = makeBedrock([
      emptyStopWithReason("max_tokens"),  // iter 1 → ladder will bump
      emptyStopWithReason("max_tokens"),  // iter 2 → bump again
      emptyStopWithReason("max_tokens"),  // iter 3 → already at top, stay
      emptyStopWithReason("max_tokens"),  // iter 4 → final premature_stop event
    ], observed);
    const agent = new Agent({ bedrock, hub: makeHub(), systemPrompt: "x" });
    const messages = [
      { role: "user", content: "do the thing" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "fake__tool", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
    ];
    const events = [];
    for await (const ev of agent.run(messages, "sess-test")) {
      events.push(ev);
      if (ev.type === "premature_stop" || ev.type === "done" || ev.type === "error") break;
    }
    expect(observed.length).toBeGreaterThanOrEqual(3);
    expect(observed[0].max_tokens).toBe(16384);
    expect(observed[1].max_tokens).toBe(24576);
    expect(observed[2].max_tokens).toBe(32000);
    // Caps at the top of the ladder.
    if (observed[3]) expect(observed[3].max_tokens).toBe(32000);
  }, 30_000);

  it("does NOT escalate when stop_reason is end_turn", async () => {
    const observed = [];
    const bedrock = makeBedrock([
      emptyStopWithReason("end_turn"),
      emptyStopWithReason("end_turn"),
      emptyStopWithReason("end_turn"),
      emptyStopWithReason("end_turn"),
    ], observed);
    const agent = new Agent({ bedrock, hub: makeHub(), systemPrompt: "x" });
    const messages = [
      { role: "user", content: "do the thing" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "fake__tool", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
    ];
    const events = [];
    for await (const ev of agent.run(messages, "sess-test")) {
      events.push(ev);
      if (ev.type === "premature_stop" || ev.type === "done" || ev.type === "error") break;
    }
    // Every iteration stayed at the base 16384 budget.
    for (const obs of observed) expect(obs.max_tokens).toBe(16384);
  }, 30_000);
});
