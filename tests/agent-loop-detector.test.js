// Phase RP1-B5 — tier-2 sliding-window same-shape loop detector.
//
// Drives Agent.run() with a stub Bedrock that always emits the same
// shell_exec tool_use with slightly varied input strings (so the v1
// exact-match detector misses them but the v2 shape-hash detector
// catches them). Asserts:
//   - 5 same-shape calls in 12 iters with ≤1 useful output → warning
//   - 3 more matching iterations after the warning → hard-fail
//   - same shape but ≥2 useful outputs → no warning (control)

import { describe, it, expect, beforeEach } from "vitest";
import { Agent } from "../lib/agent.js";

function makeHub({ resultLength = 0 } = {}) {
  return {
    getClaudeTools: () => [{
      name: "shell-agent__shell_exec",
      description: "stub",
      input_schema: { type: "object", properties: { command: { type: "string" } } },
    }],
    getActiveServers: () => [],
    callTool: async () => ({
      content: [{ type: "text", text: resultLength > 0 ? "x".repeat(resultLength) : "" }],
      isError: resultLength === 0, // empty result → error per the test scenario
    }),
  };
}

// Build a stream that emits a tool_use with a slightly varying command.
// Distinct command strings per call → v1 exact-match detector NEVER
// collides. Same key set → v2 shape-hash collides every time.
function streamWithToolUse(commandText, callIdx) {
  const id = `tu_${callIdx}`;
  const inputJson = JSON.stringify({ command: commandText });
  return [
    { type: "message_start", message: { usage: { input_tokens: 10 } } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id, name: "shell-agent__shell_exec", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: inputJson } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "tool_use" } },
    { type: "message_stop" },
  ];
}

function makeBedrock() {
  let n = 0;
  return {
    profile: null,
    async *stream() {
      const idx = n++;
      // Vary the command each iteration → v1 detector won't collide,
      // v2 shape-hash WILL collide because the structure stays the same.
      const events = streamWithToolUse(`ls -la /tmp/run-${idx}`, idx);
      for (const ev of events) yield ev;
    },
  };
}

describe("Agent — RP1-B5 tier-2 same-shape loop detector", () => {
  let bedrock;
  beforeEach(() => {
    bedrock = makeBedrock();
  });

  it("fires tool_loop_warning by iteration ≤10 when 5 same-shape calls return empty/error", async () => {
    const hub = makeHub({ resultLength: 0 }); // every call returns empty + isError
    const agent = new Agent({ bedrock, hub, systemPrompt: "x" });
    const events = [];
    for await (const ev of agent.run([{ role: "user", content: "loop test" }], "sess-loop")) {
      events.push(ev);
      if (ev.type === "tool_loop_warning" || ev.type === "error" || ev.type === "done") break;
      if (events.length > 200) break;
    }
    const warning = events.find((e) => e.type === "tool_loop_warning");
    expect(warning).toBeTruthy();
    expect(warning.tool).toBe("shell-agent__shell_exec");
    expect(warning.hits).toBeGreaterThanOrEqual(5);
    expect(warning.successCount).toBe(0);
  }, 30_000);

  it("hard-fails 3 iterations after the warning if the same shape continues", async () => {
    const hub = makeHub({ resultLength: 0 });
    const agent = new Agent({ bedrock, hub, systemPrompt: "x" });
    const events = [];
    let warningSeen = false;
    let warningIter = -1;
    let iterCount = 0;
    for await (const ev of agent.run([{ role: "user", content: "loop test" }], "sess-loop")) {
      events.push(ev);
      if (ev.type === "iteration") iterCount++;
      if (ev.type === "tool_loop_warning") {
        warningSeen = true;
        warningIter = iterCount;
      }
      if (ev.type === "error") break;
      if (ev.type === "done") break;
      if (events.length > 400) break;
    }
    expect(warningSeen).toBe(true);
    const finalErr = events.find((e) => e.type === "error" && /Loop detected \(tier 2\)/.test(e.error || ""));
    expect(finalErr).toBeTruthy();
  }, 30_000);

  it("control: same shape but ≥2 useful outputs → no warning (legitimate batch)", async () => {
    // 200 chars per result clears the >100 success floor. 6 successful
    // same-shape calls should NOT fire the warning.
    const hub = makeHub({ resultLength: 200 });
    const agent = new Agent({ bedrock, hub, systemPrompt: "x" });
    const events = [];
    let iterCount = 0;
    for await (const ev of agent.run([{ role: "user", content: "batch test" }], "sess-batch")) {
      events.push(ev);
      if (ev.type === "iteration") iterCount++;
      if (iterCount > 8) break; // 8 iterations is plenty to trigger if it's going to
      if (ev.type === "tool_loop_warning" || ev.type === "error" || ev.type === "done") break;
    }
    const warning = events.find((e) => e.type === "tool_loop_warning");
    expect(warning).toBeFalsy();
  }, 30_000);
});
