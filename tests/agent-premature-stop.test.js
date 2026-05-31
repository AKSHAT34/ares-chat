// Phase RP1-B1 — premature-stop recovery.
//
// Drives Agent.run() with a stubbed Bedrock driver that always emits
// an empty assistant turn ending in `end_turn`. With one prior
// tool_result in the working transcript, the agent's recovery path
// classifies this as a "premature stop" and nudges. After the third
// nudge fails, the agent must yield `premature_stop` (NOT `done`) so
// the auto-recorder can tag the memory entry as incomplete.
//
// We also cover the silently-completing path (chitchat, no tool_result
// in history) — that's NOT a premature stop and must still yield `done`.

import { describe, it, expect, beforeEach } from "vitest";
import { Agent } from "../lib/agent.js";

// Minimal hub stub — agent only needs getClaudeTools (returns [] is fine
// since we don't fire tool calls in this test) and getActiveServers.
function makeHub() {
  return {
    getClaudeTools: () => [],
    getActiveServers: () => [],
    callTool: async () => ({ isError: true, content: [{ type: "text", text: "stub" }] }),
  };
}

// Build a fake bedrock driver. `script` is an array of "responses",
// where each response is the sequence of stream events to yield.
// One response per Agent iteration. `profile=null` makes the
// peekCredentials check no-op (cache miss → no refresh).
function makeBedrock(script) {
  let nextIdx = 0;
  return {
    profile: null,
    async *stream() {
      const events = script[nextIdx] || script[script.length - 1];
      nextIdx++;
      for (const ev of events) yield ev;
    },
    invoke: async () => ({ content: [{ type: "text", text: "" }], stop_reason: "end_turn" }),
  };
}

// Convenience: assemble a stream-event sequence for an "empty assistant
// turn that ends with `end_turn`". The agent's premature-stop classifier
// is keyed on stop_reason + content length + previous-turn shape.
function emptyEndTurn() {
  return [
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    // No content_block_delta — totalChars stays 0
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" } },
    { type: "message_stop" },
  ];
}

describe("Agent — RP1-B1 premature-stop recovery", () => {
  let hub;
  beforeEach(() => {
    hub = makeHub();
  });

  it("emits 3 nudges then yields premature_stop on a stuck mid-workflow turn", async () => {
    // Four consecutive empty end_turns: the agent should consume
    // attempts 1, 2, 3 as nudges and emit `premature_stop` on attempt 4.
    const bedrock = makeBedrock([
      emptyEndTurn(),
      emptyEndTurn(),
      emptyEndTurn(),
      emptyEndTurn(),
    ]);
    const agent = new Agent({ bedrock, hub, systemPrompt: "x" });

    // Seed a tool_result so the recovery classifier sees a mid-workflow stop.
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

    // Three stalled-with-reason=premature-stop nudges must precede the final event.
    const stalled = events.filter((e) => e.type === "stalled" && e.reason === "premature-stop");
    expect(stalled.length).toBe(3);
    // Each nudge carries a 1-indexed attempt label.
    expect(stalled.map((e) => e.attempt)).toEqual([1, 2, 3]);

    // Final event is premature_stop, not done.
    const last = events[events.length - 1];
    expect(last.type).toBe("premature_stop");
    expect(last.lastAttempt).toBe(3);
    expect(Array.isArray(last.nudgeHistory)).toBe(true);
    expect(last.nudgeHistory.length).toBe(3);

    // No `done` was emitted on the way out.
    expect(events.some((e) => e.type === "done")).toBe(false);
  }, 30_000);

  it("the three nudge texts are distinct", async () => {
    const bedrock = makeBedrock([
      emptyEndTurn(),
      emptyEndTurn(),
      emptyEndTurn(),
      emptyEndTurn(),
    ]);
    const agent = new Agent({ bedrock, hub, systemPrompt: "x" });
    const messages = [
      { role: "user", content: "do the thing" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "fake__tool", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
    ];
    const events = [];
    for await (const ev of agent.run(messages, "sess-test")) {
      events.push(ev);
      if (ev.type === "premature_stop") break;
    }
    const last = events[events.length - 1];
    const texts = last.nudgeHistory.map((h) => h.nudgeText);
    expect(new Set(texts).size).toBe(3);
    // Sanity: each later nudge must be longer than (or differently keyed
    // from) the first — we enforce distinctness, not length.
    expect(texts[0]).not.toBe(texts[1]);
    expect(texts[1]).not.toBe(texts[2]);
  }, 30_000);

  it("non-premature stop (no prior tool_result) still yields done on first empty turn", async () => {
    // Single empty end_turn; no tool_result in history → not premature.
    const bedrock = makeBedrock([emptyEndTurn()]);
    const agent = new Agent({ bedrock, hub, systemPrompt: "x" });
    const messages = [{ role: "user", content: "hi" }];
    const events = [];
    for await (const ev of agent.run(messages, "sess-test")) {
      events.push(ev);
      if (ev.type === "done" || ev.type === "premature_stop" || ev.type === "error") break;
    }
    const last = events[events.length - 1];
    expect(last.type).toBe("done");
    // No nudges fired — the only stalled events would have reason=stalled,
    // not premature-stop.
    expect(events.some((e) => e.type === "stalled" && e.reason === "premature-stop")).toBe(false);
  }, 30_000);
});
