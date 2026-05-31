// Phase-3 audit · B-14 · openStreamLog must close prior emitter before replacing it.
//
// Pre-fix bug: openStreamLog overwrote streamLogState entry with a new
// EventEmitter but never emitted "closed" on the prior one. Live tail
// clients on the prior emitter never received the closed signal and
// orphaned for their full timeout window.

import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function makeStreamLogModule(dir) {
  const state = new Map();
  const p = (id) => path.join(dir, `${id}.jsonl`);
  function openStreamLog(id) {
    closeStreamLog(id); // <-- the fix
    try { fs.unlinkSync(p(id)); } catch {}
    const s = { seq: 0, emitter: new EventEmitter(), startedAt: Date.now() };
    s.emitter.setMaxListeners(50);
    state.set(id, s);
    return s;
  }
  function closeStreamLog(id) {
    const s = state.get(id);
    if (!s) return;
    s.emitter.emit("closed");
    state.delete(id);
    try { fs.unlinkSync(p(id)); } catch {}
  }
  return { state, openStreamLog, closeStreamLog };
}

describe("Phase-3 B-14 · stream-log emitter close on overwrite", () => {
  it("emits 'closed' on the prior emitter before replacing it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-streamlog-"));
    const mod = makeStreamLogModule(dir);

    const sessionId = "ses-1";
    const first = mod.openStreamLog(sessionId);

    let closedFired = 0;
    first.emitter.on("closed", () => { closedFired++; });

    // Open again for the same session — simulates a new run on the same id.
    const second = mod.openStreamLog(sessionId);

    expect(closedFired).toBe(1);
    expect(second).not.toBe(first);
    expect(mod.state.get(sessionId)).toBe(second);
  });

  it("does NOT emit closed on the new emitter when a fresh session opens", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-streamlog-"));
    const mod = makeStreamLogModule(dir);
    const s1 = mod.openStreamLog("ses-A");
    let closedA = 0;
    s1.emitter.on("closed", () => { closedA++; });
    // Open a different session — must not trigger closed on ses-A.
    const s2 = mod.openStreamLog("ses-B");
    expect(closedA).toBe(0);
    expect(s2).not.toBe(s1);
  });
});
