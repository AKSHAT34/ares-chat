// Phase RP1-B3 — transform primitive tests.

import { describe, it, expect } from "vitest";
import { parseTransform, applyTransform } from "../lib/tool-args/transforms.js";

describe("parseTransform", () => {
  it("parses inject:path=value", () => {
    expect(parseTransform("inject:foo=42")).toEqual({ kind: "inject", path: "foo", value: 42 });
    expect(parseTransform('inject:foo="bar"')).toEqual({ kind: "inject", path: "foo", value: "bar" });
    expect(parseTransform('inject:a.b={"x":1}')).toEqual({ kind: "inject", path: "a.b", value: { x: 1 } });
  });
  it("parses rename:from->to", () => {
    expect(parseTransform("rename:vendor_code->vendorCode"))
      .toEqual({ kind: "rename", from: "vendor_code", to: "vendorCode" });
  });
  it("parses coerce:path:type", () => {
    expect(parseTransform("coerce:tags:array")).toEqual({ kind: "coerce", path: "tags", type: "array" });
  });
  it("rejects unknown kinds", () => {
    expect(() => parseTransform("delete:foo")).toThrow(/unknown transform/);
  });
});

describe("applyTransform — inject", () => {
  it("injects when target is missing", () => {
    const r = applyTransform({}, parseTransform('inject:foo="bar"'));
    expect(r.applied).toBe(true);
    expect(r.args).toEqual({ foo: "bar" });
  });
  it("does NOT overwrite an existing value", () => {
    const r = applyTransform({ foo: "user-set" }, parseTransform('inject:foo="default"'));
    expect(r.applied).toBe(false);
    expect(r.args).toEqual({ foo: "user-set" });
  });
  it("creates missing intermediate objects on dotted paths", () => {
    const r = applyTransform({}, parseTransform('inject:a.b.c=42'));
    expect(r.applied).toBe(true);
    expect(r.args).toEqual({ a: { b: { c: 42 } } });
  });
  it("does not mutate input", () => {
    const input = { x: 1 };
    applyTransform(input, parseTransform('inject:y=2'));
    expect(input).toEqual({ x: 1 });
  });
});

describe("applyTransform — rename", () => {
  it("renames when from is set and to is missing", () => {
    const r = applyTransform({ vendor_code: "ABC" }, parseTransform("rename:vendor_code->vendorCode"));
    expect(r.applied).toBe(true);
    expect(r.args).toEqual({ vendorCode: "ABC" });
  });
  it("skips when destination already has a value", () => {
    const r = applyTransform({ vendor_code: "ABC", vendorCode: "XYZ" }, parseTransform("rename:vendor_code->vendorCode"));
    expect(r.applied).toBe(false);
    expect(r.args).toEqual({ vendor_code: "ABC", vendorCode: "XYZ" });
  });
  it("skips when from is missing", () => {
    const r = applyTransform({ unrelated: 1 }, parseTransform("rename:vendor_code->vendorCode"));
    expect(r.applied).toBe(false);
  });
});

describe("applyTransform — coerce", () => {
  it("coerces a string to an array via comma-split", () => {
    const r = applyTransform({ tags: "a,b,c" }, parseTransform("coerce:tags:array"));
    expect(r.applied).toBe(true);
    expect(r.args.tags).toEqual(["a", "b", "c"]);
  });
  it("parses JSON-array strings", () => {
    const r = applyTransform({ tags: '["x","y"]' }, parseTransform("coerce:tags:array"));
    expect(r.applied).toBe(true);
    expect(r.args.tags).toEqual(["x", "y"]);
  });
  it("leaves arrays untouched", () => {
    const r = applyTransform({ tags: ["x"] }, parseTransform("coerce:tags:array"));
    expect(r.applied).toBe(false);
    expect(r.args.tags).toEqual(["x"]);
  });
  it("coerces number strings", () => {
    const r = applyTransform({ n: "42" }, parseTransform("coerce:n:number"));
    expect(r.applied).toBe(true);
    expect(r.args.n).toBe(42);
  });
  it("coerces boolean strings", () => {
    expect(applyTransform({ x: "true" }, parseTransform("coerce:x:boolean")).args.x).toBe(true);
    expect(applyTransform({ x: "false" }, parseTransform("coerce:x:boolean")).args.x).toBe(false);
  });
});
