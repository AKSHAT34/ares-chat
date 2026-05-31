// Phase U11 — skills self-improvement tests.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpHub } from "../lib/mcp-client.js";
import { recordSkillEvent, rollup, _resetForTests } from "../lib/skills/telemetry.js";
import { classify } from "../lib/approval.js";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const FAKE = path.join(os.tmpdir(), `ares-test-skills-${process.pid}.json`);

function makeHub() {
  writeFileSync(FAKE, JSON.stringify({ mcpServers: {} }));
  const hub = new McpHub({ mcpJsonPath: FAKE, log: () => {}, alwaysActive: new Set() });
  return hub;
}

beforeEach(() => {
  _resetForTests();
  if (existsSync(FAKE)) {
    try { unlinkSync(FAKE); } catch {}
  }
});

describe("skills telemetry — recordSkillEvent + rollup", () => {
  it("records a skill_search with hitCount derived from JSON content", () => {
    recordSkillEvent({
      kind: "search",
      args: { query: "vendor email" },
      result: { content: [{ type: "text", text: '[{"slug":"a","title":"A"},{"slug":"b","title":"B"}]' }] },
      durationMs: 12,
    });
    const r = rollup();
    expect(r.counts.searches).toBe(1);
    expect(r.recent[0].hitCount).toBe(2);
    expect(r.recent[0].zeroHits).toBe(false);
  });

  it("zero-hit search increments the zeroHitSearchRate denominator", () => {
    recordSkillEvent({ kind: "search", args: { query: "x" }, result: { content: [{ type: "text", text: "[]" }] } });
    recordSkillEvent({ kind: "search", args: { query: "y" }, result: { content: [{ type: "text", text: "[]" }] } });
    recordSkillEvent({ kind: "search", args: { query: "z" }, result: { content: [{ type: "text", text: '[{"slug":"a"}]' }] } });
    const r = rollup();
    expect(r.counts.searches).toBe(3);
    expect(r.rates.zeroHitSearchRate).toBeCloseTo(2 / 3, 2);
  });

  it("record_run success drives runSuccessRate", () => {
    recordSkillEvent({ kind: "record_run", args: { slug: "a", success: true } });
    recordSkillEvent({ kind: "record_run", args: { slug: "a", success: false } });
    const r = rollup();
    expect(r.counts.runs).toBe(2);
    expect(r.counts.successfulRuns).toBe(1);
    expect(r.rates.runSuccessRate).toBe(0.5);
  });

  it("save event tags the slug parsed from the result text", () => {
    recordSkillEvent({
      kind: "save",
      args: { title: "My new skill" },
      result: { content: [{ type: "text", text: '{"slug":"my-new-skill","path":"…"}' }] },
    });
    const r = rollup();
    expect(r.recent[0].slug).toBe("my-new-skill");
    expect(r.recent[0].isError).toBe(false);
  });

  it("rollup with no events returns nullable rates rather than NaN", () => {
    const r = rollup();
    expect(r.counts.events).toBe(0);
    expect(r.rates.zeroHitSearchRate).toBeNull();
    expect(r.rates.runSuccessRate).toBeNull();
  });
});

describe("ares_skill_propose_patch — classifier + meta-tool", () => {
  it("approval.classify marks the meta-tool as HIGH-risk + requireConfirm", () => {
    const v = classify("ares_skill_propose_patch", { slug: "x", reason: "fix step 3", steps: "..." });
    expect(v.risk).toBe("high");
    expect(v.requireConfirm).toBe(true);
  });

  it("the tool is registered in META_TOOLS via getClaudeTools()", () => {
    const hub = makeHub();
    const tools = hub.getClaudeTools();
    const t = tools.find((x) => x.name === "ares_skill_propose_patch");
    expect(t).toBeTruthy();
    expect(t.input_schema.required).toEqual(["slug", "reason"]);
    expect(t.description).toMatch(/skill/i);
    expect(t.description).toMatch(/approval/i);
  });

  it("rejects calls without slug", async () => {
    const hub = makeHub();
    const r = await hub.callTool("ares_skill_propose_patch", { reason: "x" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/slug is required/);
  });

  it("rejects calls without reason", async () => {
    const hub = makeHub();
    const r = await hub.callTool("ares_skill_propose_patch", { slug: "abc" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/reason is required/);
  });

  it("rejects calls with no actual change fields", async () => {
    const hub = makeHub();
    const r = await hub.callTool("ares_skill_propose_patch", { slug: "abc", reason: "test" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/at least one field/);
  });

  it("returns a clear error when the skills MCP isn't running", async () => {
    const hub = makeHub();
    const r = await hub.callTool("ares_skill_propose_patch", {
      slug: "abc", reason: "test", steps: "## new step",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/skills MCP is not running/);
  });

  it("delegates to skills__skill_save with overwrite=true when the MCP is up", async () => {
    const hub = makeHub();
    // Stub a "running" skills MCP.
    let savedArgs = null;
    hub.specs.set("skills", { command: "stub", args: [] });
    hub.state.set("skills", {
      tools: [{ name: "skills__skill_save", description: "", input_schema: {}, serverName: "skills", toolName: "skill_save" }],
      state: "running",
      breaker: { fails: 0, openedAt: 0 },
      client: {
        callTool: async (req) => {
          savedArgs = req.arguments;
          return { content: [{ type: "text", text: '{"slug":"test","path":"…"}' }] };
        },
      },
    });
    const r = await hub.callTool("ares_skill_propose_patch", {
      slug: "test",
      reason: "step 4 was missing the cwd flag",
      steps: "1. do x\n2. do y\n3. do z\n4. cd into the right dir first",
    });
    expect(r.isError).toBe(false);
    expect(savedArgs.overwrite).toBe(true);
    expect(savedArgs.notes).toMatch(/patched by ares_skill_propose_patch/);
    expect(savedArgs.notes).toMatch(/step 4 was missing the cwd flag/);
  });
});

describe("hub observation hook — skill_search → telemetry", () => {
  it("hub.callTool records a search event with the hit count", async () => {
    const hub = makeHub();
    // Stub a "running" skills MCP that returns a 1-hit search.
    hub.specs.set("skills", { command: "stub", args: [] });
    hub.state.set("skills", {
      tools: [{
        name: "skills__skill_search",
        description: "",
        input_schema: {},
        serverName: "skills",
        toolName: "skill_search",
      }],
      state: "running",
      breaker: { fails: 0, openedAt: 0 },
      client: {
        callTool: async () => ({ content: [{ type: "text", text: '[{"slug":"a","title":"A"}]' }] }),
      },
    });
    await hub.callTool("skills__skill_search", { query: "vendor email" });
    const r = rollup();
    expect(r.counts.searches).toBe(1);
    expect(r.recent[0].hitCount).toBe(1);
    expect(r.recent[0].args.query).toBe("vendor email");
  });
});
