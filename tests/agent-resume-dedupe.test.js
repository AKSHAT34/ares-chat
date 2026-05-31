// Phase-3 audit · B-1 · mid-stream credential resume must NOT duplicate
// emitted text deltas or content blocks.
//
// Pre-fix bug: bedrock-driver re-opened the stream on credential expiry
// and yielded the second message_start + replayed content. The agent
// loop's accumulators (assistantContent, currentBlock, currentToolInputJson,
// textDeltaBytesThisIter) were NOT reset. Result: every text_delta the
// user already saw was yielded again, and any tool_use block from the
// pre-refresh stream was pushed onto assistantContent twice and dispatched
// twice.
//
// Post-fix: bedrock-driver yields a `_resume_reset` sentinel just before
// re-yielding the resumed stream. The agent's switch handles it by
// clearing accumulators.

import { describe, it, expect } from "vitest";
import { Agent } from "../lib/agent.js";

// Hub stub: tracks every callTool dispatch so we can assert the
// duplication regression doesn't return.
function makeHub(dispatched) {
  return {
    getClaudeTools: () => [{
      name: "fake__tool",
      description: "x",
      input_schema: { type: "object", properties: {} },
    }],
    getActiveServers: () => [],
    callTool: async (name, input) => {
      dispatched.push({ name, input });
      return { isError: false, content: [{ type: "text", text: "ok" }] };
    },
  };
}

// Two-iteration script:
//   iter 1: text_delta "hello ", then resume sentinel, then text_delta "world", then tool_use, then tool_use stop_reason.
//   iter 2: empty end_turn (so the agent terminates after the tool round-trip).
//
// The fake bedrock yields the *resumed* stream as if the driver already
// observed the credential error and recovered. The reset sentinel comes
// BEFORE the replayed message_start.
function makeResumeBedrock() {
  const iters = [[
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hello " } },
    // Mid-stream cred refresh: bedrock-driver emits these two events
    // before the resumed message_start. The agent must reset state on
    // _resume_reset.
    { type: "credentials_refreshing", phase: "mid-stream", attempt: 1 },
    { type: "_resume_reset", attempt: 1 },
    // Replay starts here — fresh message.
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "world" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tu1", name: "fake__tool", input: {} } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{}" } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: "tool_use" } },
    { type: "message_stop" },
  ], [
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "done" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" } },
    { type: "message_stop" },
  ]];
  let i = 0;
  return {
    profile: null,
    async *stream() {
      const evs = iters[i] || iters[iters.length - 1];
      i++;
      for (const ev of evs) yield ev;
    },
    invoke: async () => ({ content: [{ type: "text", text: "" }], stop_reason: "end_turn" }),
  };
}

describe("Phase-3 B-1 · agent resets accumulators on _resume_reset", () => {
  it("dispatches the post-resume tool_use exactly once", async () => {
    const dispatched = [];
    const bedrock = makeResumeBedrock();
    const agent = new Agent({ bedrock, hub: makeHub(dispatched), systemPrompt: "x", log: () => {} });
    const events = [];
    for await (const ev of agent.run([{ role: "user", content: "go" }], "sess-test")) {
      events.push(ev);
      if (ev.type === "done" || ev.type === "premature_stop" || ev.type === "error") break;
    }
    // Tool dispatched exactly once (pre-fix this would be 2 because the
    // pre-refresh tool_use leaked through onto assistantContent).
    const fakeCalls = dispatched.filter((d) => d.name === "fake__tool");
    expect(fakeCalls.length).toBe(1);
  }, 30_000);

  it("yields each text_delta to the user once after reset (pre-refresh deltas dropped)", async () => {
    const dispatched = [];
    const bedrock = makeResumeBedrock();
    const agent = new Agent({ bedrock, hub: makeHub(dispatched), systemPrompt: "x", log: () => {} });
    const events = [];
    for await (const ev of agent.run([{ role: "user", content: "go" }], "sess-test")) {
      events.push(ev);
      if (ev.type === "done" || ev.type === "premature_stop" || ev.type === "error") break;
    }
    // The visible text_deltas after the reset: "world" exactly once
    // (from iter 1's post-resume stream). The pre-resume "hello " IS
    // yielded to the SSE stream upstream of reset (it was already on
    // the wire) — that's fine, the user has already seen it. What
    // MUST NOT be present is a SECOND copy of "world" or any
    // duplicated tool_use surface. (We don't pin "done" count: the
    // fake bedrock falls back to the last iter for subsequent loops,
    // so the agent may see additional end-turn cycles after the
    // tool round-trip.)
    const texts = events.filter((e) => e.type === "text_delta").map((e) => e.text);
    expect(texts.filter((t) => t === "world").length).toBe(1);
    // "hello " appeared exactly once in the SSE stream (the pre-reset
    // fragment that did reach the user before the refresh).
    expect(texts.filter((t) => t === "hello ").length).toBe(1);
  }, 30_000);

  it("emits credentials_resumed when the reset sentinel fires", async () => {
    const dispatched = [];
    const bedrock = makeResumeBedrock();
    const agent = new Agent({ bedrock, hub: makeHub(dispatched), systemPrompt: "x", log: () => {} });
    const events = [];
    for await (const ev of agent.run([{ role: "user", content: "go" }], "sess-test")) {
      events.push(ev);
      if (ev.type === "done" || ev.type === "premature_stop" || ev.type === "error") break;
    }
    expect(events.some((e) => e.type === "credentials_resumed")).toBe(true);
    expect(events.some((e) => e.type === "credentials_refreshing")).toBe(true);
  }, 30_000);
});
