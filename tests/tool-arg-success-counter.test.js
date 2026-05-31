// Phase-3 audit · B-8 · success counter must only bump APPLIED transforms.
//
// Pre-fix bug: dispatch path iterated `store.fixesFor(toolName)` for every
// store-fix warning and bumped recordSuccess on every fix, multiplying the
// count by the number of promoted fixes for that tool. Promotion threshold
// + telemetry both became unreliable.
//
// We re-implement the smallest correct surface here — the dispatch-path
// success-recording snippet — and assert it bumps only the actually-applied
// transforms.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ToolArgStore } from "../lib/tool-args/store.js";

let tmpFile;

function makeStore() {
  tmpFile = path.join(os.tmpdir(), `ares-args-${Date.now()}-${Math.random()}.jsonl`);
  // Pre-seed two PROMOTED fixes so fixesFor returns multiple. We don't go
  // through .load() since we want a deterministic state.
  const store = new ToolArgStore({ filePath: tmpFile });
  store._loaded = true;
  store.entries = [
    { toolName: "demo__tool", errorRegex: "x", transform: "rename:a->b",
      promoted: true, applications: 0, successes: 0, addedAt: Date.now(), lastSuccessAt: 0 },
    { toolName: "demo__tool", errorRegex: "y", transform: "rename:c->d",
      promoted: true, applications: 0, successes: 0, addedAt: Date.now(), lastSuccessAt: 0 },
    { toolName: "demo__tool", errorRegex: "z", transform: "rename:e->f",
      promoted: true, applications: 0, successes: 0, addedAt: Date.now(), lastSuccessAt: 0 },
  ];
  return store;
}

describe("Phase-3 B-8 · tool-arg success counter only bumps applied transforms", () => {
  beforeEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it("bumping a single applied transform advances ONLY that entry's success counter", () => {
    const store = makeStore();
    // Simulate the post-fix dispatch path: appliedTransforms == ["rename:a->b"].
    const appliedTransforms = ["rename:a->b"];
    for (const t of appliedTransforms) {
      store.recordSuccess({ toolName: "demo__tool", transform: t });
    }
    const e1 = store.entries.find((e) => e.transform === "rename:a->b");
    const e2 = store.entries.find((e) => e.transform === "rename:c->d");
    const e3 = store.entries.find((e) => e.transform === "rename:e->f");
    expect(e1.successes).toBe(1);
    // Pre-fix bug would have bumped these too. Post-fix: untouched.
    expect(e2.successes).toBe(0);
    expect(e3.successes).toBe(0);
  });

  it("multiple applied transforms each bump exactly once per dispatch", () => {
    const store = makeStore();
    const appliedTransforms = ["rename:a->b", "rename:c->d"];
    for (const t of appliedTransforms) {
      store.recordSuccess({ toolName: "demo__tool", transform: t });
    }
    const e1 = store.entries.find((e) => e.transform === "rename:a->b");
    const e2 = store.entries.find((e) => e.transform === "rename:c->d");
    const e3 = store.entries.find((e) => e.transform === "rename:e->f");
    expect(e1.successes).toBe(1);
    expect(e2.successes).toBe(1);
    expect(e3.successes).toBe(0);
  });

  it("promotion threshold is reached after 3 dispatches, not 1×3 inflated", () => {
    const store = makeStore();
    // Demote one entry so we can verify the promotion path.
    store.entries[0].promoted = false;
    store.entries[0].successes = 0;
    // Three dispatches that each apply ONLY this transform.
    for (let i = 0; i < 3; i++) {
      store.recordSuccess({ toolName: "demo__tool", transform: "rename:a->b" });
    }
    const e1 = store.entries.find((e) => e.transform === "rename:a->b");
    expect(e1.successes).toBe(3);
    expect(e1.promoted).toBe(true);
  });
});
