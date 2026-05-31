// Phase-3 audit · B-15 · activeRuns must hold a Set per session.
//
// Pre-fix bug: activeRuns was Map<sessionId, AbortController>. A second tab
// on the same session OVERWROTE the controller; /stop in tab 1 aborted
// tab 2's run; tab 1's run kept streaming.
//
// We can't easily import server.js (heavy boot side-effects), so we
// re-implement the small surface under test — the registry + abortRuns —
// and assert the contract.

import { describe, it, expect } from "vitest";

function makeRegistry() {
  const map = new Map();
  return {
    register(sessionId, controller) {
      let s = map.get(sessionId);
      if (!s) { s = new Set(); map.set(sessionId, s); }
      s.add(controller);
    },
    unregister(sessionId, controller) {
      const s = map.get(sessionId);
      if (!s) return;
      s.delete(controller);
      if (s.size === 0) map.delete(sessionId);
    },
    abort(sessionId) {
      const s = map.get(sessionId);
      if (!s || s.size === 0) return 0;
      let n = 0;
      for (const c of [...s]) { try { c.abort(); n++; } catch {} }
      return n;
    },
    snapshot() { return map; },
  };
}

describe("Phase-3 B-15 · activeRuns is a Set per session", () => {
  it("aborts every concurrent controller for the session", () => {
    const reg = makeRegistry();
    const sid = "session-X";
    const c1 = new AbortController();
    const c2 = new AbortController();
    reg.register(sid, c1);
    reg.register(sid, c2);

    const aborted = reg.abort(sid);
    expect(aborted).toBe(2);
    expect(c1.signal.aborted).toBe(true);
    expect(c2.signal.aborted).toBe(true);
  });

  it("returns 0 when there is no active run", () => {
    const reg = makeRegistry();
    expect(reg.abort("nope")).toBe(0);
  });

  it("does not abort runs on a different session", () => {
    const reg = makeRegistry();
    const a = new AbortController();
    const b = new AbortController();
    reg.register("A", a);
    reg.register("B", b);
    reg.abort("A");
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
  });

  it("removes the session entry when the last controller unregisters", () => {
    const reg = makeRegistry();
    const c = new AbortController();
    reg.register("S", c);
    expect(reg.snapshot().has("S")).toBe(true);
    reg.unregister("S", c);
    expect(reg.snapshot().has("S")).toBe(false);
  });

  it("registering a second controller does not overwrite the first", () => {
    // The pre-fix regression: a Map<sid, controller> would have lost c1.
    const reg = makeRegistry();
    const c1 = new AbortController();
    const c2 = new AbortController();
    reg.register("S", c1);
    reg.register("S", c2);
    const set = reg.snapshot().get("S");
    expect(set.size).toBe(2);
    expect(set.has(c1)).toBe(true);
    expect(set.has(c2)).toBe(true);
  });
});
