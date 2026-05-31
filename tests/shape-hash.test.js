// Phase RP1-B5 — shape-hash fingerprint helper.

import { describe, it, expect } from "vitest";
import { shapeHash, shapeOf } from "../lib/util/shape-hash.js";

describe("shapeOf", () => {
  it("collapses leaf strings to <str> token", () => {
    expect(shapeOf({ a: "x" })).toEqual({ a: "<str>" });
    expect(shapeOf({ a: "y" })).toEqual({ a: "<str>" });
  });
  it("preserves type distinctions for non-string scalars", () => {
    expect(shapeOf({ a: 1 })).toEqual({ a: "<num>" });
    expect(shapeOf({ a: true })).toEqual({ a: "<bool>" });
    expect(shapeOf({ a: null })).toEqual({ a: "<null>" });
    expect(shapeOf({ a: "1" })).toEqual({ a: "<str>" });
  });
  it("preserves array structure including length per index", () => {
    expect(shapeOf([1, "x", true])).toEqual(["<num>", "<str>", "<bool>"]);
    expect(shapeOf([])).toEqual([]);
  });
  it("normalises object key order so reordered inputs hash the same", () => {
    expect(shapeOf({ b: 1, a: "x" })).toEqual(shapeOf({ a: "x", b: 1 }));
  });
  it("recurses into nested objects", () => {
    expect(shapeOf({ outer: { inner: "x" } })).toEqual({ outer: { inner: "<str>" } });
  });
});

describe("shapeHash", () => {
  it("collides on different leaf string values", () => {
    expect(shapeHash({ command: "ls /tmp" })).toBe(shapeHash({ command: "ls /var" }));
  });
  it("does NOT collide on different key sets", () => {
    expect(shapeHash({ command: "ls" })).not.toBe(shapeHash({ command: "ls", cwd: "/tmp" }));
  });
  it("does NOT collide on different leaf types", () => {
    expect(shapeHash({ a: "1" })).not.toBe(shapeHash({ a: 1 }));
  });
  it("hashes identical empty shapes the same", () => {
    expect(shapeHash({})).toBe(shapeHash({}));
    expect(shapeHash([])).toBe(shapeHash([]));
  });
  it("returns a stable hex string", () => {
    const h = shapeHash({ a: "x" });
    expect(typeof h).toBe("string");
    expect(h).toMatch(/^[a-f0-9]{40}$/); // sha-1 = 40 hex chars
  });
  it("collides on huge inputs that share head structure (maxBytes truncation)", () => {
    const big1 = { a: "x".repeat(50000), b: "y" };
    const big2 = { a: "z".repeat(50000), b: "w" };
    expect(shapeHash(big1)).toBe(shapeHash(big2));
  });
});
