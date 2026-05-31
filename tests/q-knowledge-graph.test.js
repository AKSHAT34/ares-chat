// Phase Q13 — knowledge-graph read API.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KG_FILE = path.join(os.tmpdir(), `ares-kg-test-${process.pid}-${Date.now()}.jsonl`);
process.env.ARES_KG_FILE = KG_FILE;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const kgPath = path.join(__dirname, "..", "lib", "knowledge-graph.js");

describe("Phase Q13 · knowledge-graph read API", () => {
  beforeEach(() => {
    try {
      if (fs.existsSync(KG_FILE)) fs.unlinkSync(KG_FILE);
    } catch {}
  });

  it("rebuildEmpty creates the file idempotently", async () => {
    const m = await import(kgPath);
    const r1 = m.rebuildEmpty();
    expect(r1.ok).toBe(true);
    expect(fs.existsSync(KG_FILE)).toBe(true);
    const r2 = m.rebuildEmpty();
    expect(r2.ok).toBe(true);
  });

  it("listNodes returns [] when the file is empty", async () => {
    const m = await import(kgPath);
    m.rebuildEmpty();
    expect(m.listNodes()).toEqual([]);
    expect(m.listNodes({ type: "people" })).toEqual([]);
  });

  it("getStats returns nodes/edges counts from the JSONL", async () => {
    const m = await import(kgPath);
    fs.mkdirSync(path.dirname(KG_FILE), { recursive: true });
    fs.writeFileSync(KG_FILE, [
      JSON.stringify({ kind: "node", id: "p1", type: "people", label: "Anastasia" }),
      JSON.stringify({ kind: "node", id: "p2", type: "people", label: "Other" }),
      JSON.stringify({ kind: "edge", from: "p1", to: "p2", label: "knows" }),
    ].join("\n"));
    const stats = m.getStats();
    expect(stats.nodes).toBe(2);
    expect(stats.edges).toBe(1);
  });

  it("getNode returns the node + first-degree edges", async () => {
    const m = await import(kgPath);
    fs.mkdirSync(path.dirname(KG_FILE), { recursive: true });
    fs.writeFileSync(KG_FILE, [
      JSON.stringify({ kind: "node", id: "p1", type: "people", label: "A" }),
      JSON.stringify({ kind: "node", id: "p2", type: "people", label: "B" }),
      JSON.stringify({ kind: "edge", from: "p1", to: "p2", label: "knows" }),
    ].join("\n"));
    const r = m.getNode("p1");
    expect(r.node?.id).toBe("p1");
    expect(r.edges.length).toBe(1);
    expect(r.edges[0].to).toBe("p2");
  });
});
