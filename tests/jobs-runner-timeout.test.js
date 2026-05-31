// Phase-3b · B-28 + B-29 — runner wallclock timeout + busy-skip queueing.
//
// We avoid the heavy JOBS registry and bedrock side-effects by
// constructing a JobRunner with a single ad-hoc job stubbed in via
// `_findJob`. The hub stub is just enough to satisfy activate/deactivate.

import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JobRunner } from "../lib/jobs/runner.js";
import { openStore } from "../lib/jobs/store.js";

beforeAll(() => {
  // The runner pulls the jobs.db lazily via openStore() with no args.
  // Pre-open with a tmp dir so test runs are isolated from the user's
  // real ~/.kiro/cache/ database.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ares-jobs-test-"));
  openStore(tmp);
});

function makeHub() {
  return {
    activate: vi.fn(async () => ({ active: true })),
    deactivate: vi.fn(async () => true),
    callTool: vi.fn(async () => ({ isError: false, content: [] })),
  };
}

describe("Phase-3b B-28 · static-handler wallclock timeout", () => {
  let runner;
  beforeEach(() => {
    runner = new JobRunner({ hub: makeHub(), bedrockFactory: () => null, log: () => {}, systemPrompt: "" });
  });

  it("times out a hanging handler and reports status='timeout'", async () => {
    const job = {
      id: "test-hang",
      title: "Hang",
      mcps: [],
      runTimeoutMs: 50,
      handler: () => new Promise(() => { /* never resolves */ }),
    };
    runner._findJob = (id) => (id === "test-hang" ? job : null);
    const r = await runner.runJob("test-hang", "manual");
    expect(r.status).toBe("timeout");
    expect(runner.activeRuns.has("test-hang")).toBe(false);
  });

  it("clears activeRuns even on timeout so the next tick can fire", async () => {
    const job = {
      id: "test-clear",
      title: "Clear",
      mcps: [],
      runTimeoutMs: 30,
      handler: () => new Promise(() => {}),
    };
    runner._findJob = (id) => job;
    await runner.runJob("test-clear", "manual");
    expect(runner.activeRuns.size).toBe(0);
  });

  it("uses the 5-min default when no runTimeoutMs is set (does not hang the test)", async () => {
    const job = {
      id: "test-fast",
      title: "Fast",
      mcps: [],
      handler: async () => ({ summary: "ok" }),
    };
    runner._findJob = (id) => job;
    const r = await runner.runJob("test-fast", "manual");
    expect(r.status).toBe("completed");
  });
});

describe("Phase-3b B-29 · busy-skip enqueues immediate re-run", () => {
  it("pendingImmediate is drained when the in-flight run finishes", async () => {
    const runner = new JobRunner({ hub: makeHub(), bedrockFactory: () => null, log: () => {}, systemPrompt: "" });
    let calls = 0;
    let release;
    const blocked = new Promise((r) => { release = r; });
    const job = {
      id: "test-busy",
      title: "Busy",
      mcps: [],
      handler: async () => {
        calls += 1;
        if (calls === 1) await blocked;
        return { summary: `call-${calls}` };
      },
    };
    runner._findJob = (id) => job;
    // Start the first run but DON'T await — it will block on `blocked`.
    const first = runner.runJob("test-busy", "manual");
    // Simulate a tick firing during the in-flight run: queue immediate.
    runner.pendingImmediate.add("test-busy");
    // Release the first run; the finally block must drain pendingImmediate.
    release();
    await first;
    // setImmediate scheduled the re-run; await a microtask + a 0-ms tick.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    // Wait briefly for the queued run to complete.
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(runner.pendingImmediate.has("test-busy")).toBe(false);
  });
});
