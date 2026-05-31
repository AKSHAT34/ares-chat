// Phase 10 — unit tests for lib/session-integrity.js.
// Validates the invariants Phase 4 introduced: orphan/non-adjacent/missing
// tool_result detection, the repair pass, atomic write semantics.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  validateMessages,
  validateSession,
  repairMessages,
  repairSession,
  atomicWriteJson,
} from "../lib/session-integrity.js";

describe("validateMessages", () => {
  it("accepts an empty messages array", () => {
    const r = validateMessages([]);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects non-array input", () => {
    const r = validateMessages("not an array");
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe("E_BAD_SHAPE");
  });

  it("flags bad role", () => {
    const r = validateMessages([{ role: "system", content: "hi" }]);
    expect(r.errors.some((e) => e.code === "E_BAD_ROLE")).toBe(true);
  });

  it("flags empty content array", () => {
    const r = validateMessages([{ role: "user", content: [] }]);
    expect(r.errors.some((e) => e.code === "E_EMPTY_CONTENT")).toBe(true);
  });

  it("flags orphan tool_result (no tool_use anywhere)", () => {
    const r = validateMessages([
      { role: "user", content: "hi" },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "ghost", content: [{ type: "text", text: "x" }] },
        ],
      },
    ]);
    expect(r.errors.some((e) => e.code === "E_ORPHAN_TR")).toBe(true);
  });

  it("flags missing tool_result for an assistant tool_use", () => {
    const r = validateMessages([
      { role: "user", content: "go" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu-1", name: "x", input: {} }] },
    ]);
    expect(r.errors.some((e) => e.code === "E_MISSING_TR")).toBe(true);
  });

  it("flags non-adjacent tool_result", () => {
    const r = validateMessages([
      { role: "assistant", content: [{ type: "tool_use", id: "tu-1", name: "x", input: {} }] },
      { role: "user", content: "irrelevant text" },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tu-1", content: [{ type: "text", text: "y" }] }],
      },
    ]);
    const codes = r.errors.map((e) => e.code);
    // Either non-adjacent (preferred) or missing TR (because the assistant's
    // tool_use is followed by a text-only user msg, not a tool_result).
    expect(codes.some((c) => c === "E_NONADJACENT_TR" || c === "E_MISSING_TR")).toBe(true);
  });

  it("accepts a well-formed tool_use → tool_result pair", () => {
    const r = validateMessages([
      { role: "user", content: "go" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu-1", name: "x", input: {} }] },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tu-1", content: [{ type: "text", text: "y" }] }],
      },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe("validateSession", () => {
  it("rejects null/undefined", () => {
    expect(validateSession(null).ok).toBe(false);
    expect(validateSession(undefined).ok).toBe(false);
  });

  it("rejects sessions with no id", () => {
    expect(validateSession({ messages: [] }).ok).toBe(false);
  });

  it("accepts a fresh session with empty messages", () => {
    expect(validateSession({ id: "abc", messages: [] }).ok).toBe(true);
  });
});

describe("repairMessages", () => {
  it("is a pure function (idempotent)", () => {
    const broken = [
      { role: "user", content: "hi" },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "ghost", content: [] }],
      },
    ];
    const once = repairMessages(broken);
    const twice = repairMessages(once);
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });

  it("strips orphan tool_result blocks", () => {
    const broken = [
      { role: "user", content: "hi" },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "ghost", content: [{ type: "text", text: "x" }] }],
      },
    ];
    const fixed = repairMessages(broken);
    expect(validateMessages(fixed).ok).toBe(true);
  });

  it("synthesises stub tool_results for assistant tool_use that lost its response", () => {
    const broken = [
      { role: "user", content: "go" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu-1", name: "x", input: {} }] },
    ];
    const fixed = repairMessages(broken);
    expect(validateMessages(fixed).ok).toBe(true);
    // The synthesised stub should reference tu-1 and be marked as an error.
    const stub = fixed[2]?.content?.[0];
    expect(stub?.type).toBe("tool_result");
    expect(stub?.tool_use_id).toBe("tu-1");
    expect(stub?.is_error).toBe(true);
  });

  it("drops empty content arrays", () => {
    const broken = [
      { role: "user", content: "ok" },
      { role: "assistant", content: [] },
    ];
    const fixed = repairMessages(broken);
    expect(fixed).toHaveLength(1);
    expect(validateMessages(fixed).ok).toBe(true);
  });

  it("returns [] on non-array input", () => {
    expect(repairMessages("nope")).toEqual([]);
    expect(repairMessages(null)).toEqual([]);
  });
});

describe("repairSession", () => {
  it("returns input unchanged for non-objects", () => {
    expect(repairSession(null)).toBe(null);
    expect(repairSession("nope")).toBe("nope");
  });

  it("preserves session metadata", () => {
    const s = { id: "abc", messages: [], title: "T", createdAt: 1, weird: true };
    const r = repairSession(s);
    expect(r.id).toBe("abc");
    expect(r.title).toBe("T");
    expect(r.weird).toBe(true);
  });
});

describe("atomicWriteJson", () => {
  let tmp;
  beforeAll(() => { tmp = mkdtempSync(path.join(tmpdir(), "ares-test-")); });
  afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("writes JSON and round-trips", () => {
    const f = path.join(tmp, "x.json");
    atomicWriteJson(f, { hello: "world", n: 42 });
    expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ hello: "world", n: 42 });
  });

  it("leaves no .tmp files behind on success", () => {
    const f = path.join(tmp, "y.json");
    atomicWriteJson(f, { ok: true });
    const tmps = readdirSync(tmp).filter((n) => n.endsWith(".tmp"));
    expect(tmps).toEqual([]);
  });

  it("overwrites an existing file atomically", () => {
    const f = path.join(tmp, "z.json");
    atomicWriteJson(f, { v: 1 });
    atomicWriteJson(f, { v: 2 });
    expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ v: 2 });
  });
});
