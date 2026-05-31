// Phase-4 audit · C-2 · periodic background integrity validator.
//
// Pre-fix: sessions were validated only on read AND write. A long-running
// session that nobody touched stayed drifted. The audit prompt asked for
// a 10-min timer.
//
// Post-fix: startBackgroundValidator(opts).runOnce() scans `*.json`,
// validates each, and atomic-writes a repaired copy if needed. A
// `ares_session_repaired_total` counter is bumped on each repair.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startBackgroundValidator } from "../lib/session-integrity.js";

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-integrity-bg-"));
});

function writeSession(id, obj) {
  fs.writeFileSync(path.join(tmpDir, `${id}.json`), JSON.stringify(obj));
}

describe("Phase-4 C-2 · background integrity validator", () => {
  it("runOnce repairs sessions with orphan tool_results and bumps the metric", async () => {
    // Orphan tool_result with no matching prior tool_use → repair must
    // remove it.
    writeSession("orphan", {
      id: "orphan",
      messages: [
        { role: "user", content: "hi" },
        // user-tool_result with no preceding assistant tool_use → orphan.
        { role: "user", content: [{ type: "tool_result", tool_use_id: "absent", content: "x" }] },
      ],
      schemaVersion: 1,
      createdAt: 1, updatedAt: 1,
    });
    const seenMetrics = [];
    const v = startBackgroundValidator({
      sessionsDir: tmpDir,
      log: () => {},
      metric: (n, by) => { seenMetrics.push({ n, by }); },
    });
    const result = await v.runOnce();
    v.stop();
    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expect(seenMetrics.find((m) => m.n === "ares_session_repaired_total")).toBeTruthy();
    // The on-disk file is now repaired (no orphan tool_result).
    const after = JSON.parse(fs.readFileSync(path.join(tmpDir, "orphan.json"), "utf8"));
    const hasOrphan = (after.messages || []).some((m) =>
      m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"));
    expect(hasOrphan).toBe(false);
  });

  it("does not write valid sessions back to disk", async () => {
    writeSession("ok", {
      id: "ok",
      messages: [{ role: "user", content: "hi" }],
      schemaVersion: 1,
      createdAt: 1, updatedAt: 1,
    });
    const before = fs.statSync(path.join(tmpDir, "ok.json")).mtimeMs;
    await new Promise((r) => setTimeout(r, 5));
    const v = startBackgroundValidator({ sessionsDir: tmpDir, log: () => {} });
    const result = await v.runOnce();
    v.stop();
    expect(result.repaired).toBe(0);
    const after = fs.statSync(path.join(tmpDir, "ok.json")).mtimeMs;
    expect(after).toBe(before);
  });

  it("stop() prevents further ticks", async () => {
    const v = startBackgroundValidator({
      sessionsDir: tmpDir,
      intervalMs: 5,
      log: () => {},
    });
    v.stop();
    // No assertion beyond "doesn't throw"; the timer chain must be cleared.
    await new Promise((r) => setTimeout(r, 50));
  });
});
