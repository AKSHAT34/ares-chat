// Phase-3 audit · B-21 · approve/deny must validate approvalId against the
// currently-pending entry to prevent stale-tab replay.
//
// Pre-fix bug: ApprovalRegistry.resolve(sessionId, decision) ignored any id
// from the URL/body. A user with two browser tabs open, where one tab is
// showing an OLD approval and a NEW approval is now pending, could click
// Approve on the stale UI and resolve the new (different) tool call.

import { describe, it, expect } from "vitest";
import { ApprovalRegistry } from "../lib/approval.js";

function fakeClassification() {
  return { risk: "high", reason: "test", allow: true, requireConfirm: true };
}

describe("Phase-3 B-21 · approval id replay defense", () => {
  it("backwards-compat: resolve(sid, decision) without expectedId returns boolean", () => {
    const reg = new ApprovalRegistry();
    const { id } = reg.enqueue({ sessionId: "S", toolName: "x", input: {}, classification: fakeClassification() });
    expect(typeof id).toBe("string");
    const ok = reg.resolve("S", "approve", null);
    expect(ok).toBe(true);
  });

  it("returns false for legacy callers when no pending exists", () => {
    const reg = new ApprovalRegistry();
    expect(reg.resolve("S", "approve")).toBe(false);
  });

  it("with expectedId matching the pending entry, resolves and returns { ok: true }", async () => {
    const reg = new ApprovalRegistry();
    const { id, promise } = reg.enqueue({ sessionId: "S", toolName: "x", input: {}, classification: fakeClassification() });
    const ret = reg.resolve("S", "approve", null, { expectedId: id });
    expect(ret).toEqual({ ok: true });
    const verdict = await promise;
    expect(verdict.decision).toBe("approve");
  });

  it("with expectedId NOT matching the pending entry, refuses and does NOT resolve", async () => {
    const reg = new ApprovalRegistry();
    const enqueued = reg.enqueue({ sessionId: "S", toolName: "x", input: {}, classification: fakeClassification() });
    let resolved = false;
    enqueued.promise.then(() => { resolved = true; });
    const ret = reg.resolve("S", "approve", null, { expectedId: "different-id" });
    expect(ret).toEqual({ ok: false, reason: "stale" });
    // Give the microtask queue a tick to confirm the promise did NOT resolve.
    await new Promise((r) => setTimeout(r, 5));
    expect(resolved).toBe(false);
    expect(reg.has("S")).toBe(true);
  });

  it("with expectedId and no pending, returns { ok: false, reason: 'no pending approval' }", () => {
    const reg = new ApprovalRegistry();
    const ret = reg.resolve("S", "approve", null, { expectedId: "some-id" });
    expect(ret).toEqual({ ok: false, reason: "no pending approval" });
  });

  it("supersede + race: a stale tab clicking the OLD id does NOT resolve the NEW pending", async () => {
    const reg = new ApprovalRegistry();
    const first = reg.enqueue({ sessionId: "S", toolName: "x", input: { v: 1 }, classification: fakeClassification() });
    let firstResolved = null;
    first.promise.then((v) => { firstResolved = v; });
    // The agent server in real life cancels-then-enqueues on a new pending request.
    reg.cancel("S", "superseded");
    const second = reg.enqueue({ sessionId: "S", toolName: "x", input: { v: 2 }, classification: fakeClassification() });
    let secondResolved = false;
    second.promise.then(() => { secondResolved = true; });
    // Stale tab clicks Approve with the FIRST approval id.
    const ret = reg.resolve("S", "approve", null, { expectedId: first.id });
    expect(ret.ok).toBe(false);
    expect(ret.reason).toBe("stale");
    await new Promise((r) => setTimeout(r, 5));
    // The first was already resolved (deny via cancel) — assert it was NOT
    // changed by the stale click.
    expect(firstResolved).toEqual({ decision: "deny", reason: "superseded" });
    // The second remains pending.
    expect(secondResolved).toBe(false);
    // Now clicking with the correct (second) id resolves it.
    const ret2 = reg.resolve("S", "approve", null, { expectedId: second.id });
    expect(ret2).toEqual({ ok: true });
  });
});
