// Q-pass-3 work-stream A — knowledge-graph entity drawer + search routes.
//
// Covers the new searchNodes() and setNodeMeta() helpers in
// lib/knowledge-graph.js. The summarize endpoint isn't unit-tested here
// because it depends on a live Bedrock client; the route handler in
// server.js is exercised end-to-end via the audit gate.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KG_FILE = path.join(os.tmpdir(), `ares-kg-drawer-test-${process.pid}-${Date.now()}.jsonl`);
process.env.ARES_KG_FILE = KG_FILE;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const kgPath = path.join(__dirname, "..", "lib", "knowledge-graph.js");

function _writeFixture(lines) {
  fs.mkdirSync(path.dirname(KG_FILE), { recursive: true });
  fs.writeFileSync(KG_FILE, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

describe("Q-pass-3 · KG drawer helpers", () => {
  beforeEach(() => {
    try { if (fs.existsSync(KG_FILE)) fs.unlinkSync(KG_FILE); } catch {}
  });

  it("searchNodes returns [] for empty query", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "p1", type: "person", label: "Alice" },
    ]);
    expect(m.searchNodes("")).toEqual([]);
    expect(m.searchNodes("   ")).toEqual([]);
  });

  it("searchNodes finds case-insensitive substring matches", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "p1", type: "person", label: "Anastasia COUROUVE" },
      { kind: "node", id: "p2", type: "person", label: "Bob" },
      { kind: "node", id: "p3", type: "channel", label: "anastasia-room" },
    ]);
    const r = m.searchNodes("ANASTASIA");
    expect(r).toHaveLength(2);
    // Both are prefix matches → shorter label wins the tiebreaker.
    expect(r[0].id).toBe("p3");
    expect(r[1].id).toBe("p1");
  });

  it("searchNodes prefix match ranks before mid-string match", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "n1", type: "channel", label: "general-eng" },
      { kind: "node", id: "n2", type: "channel", label: "eng-help" },
    ]);
    const r = m.searchNodes("eng");
    expect(r[0].id).toBe("n2");
  });

  it("searchNodes respects the limit", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture(
      Array.from({ length: 10 }, (_, i) => ({
        kind: "node", id: `p${i}`, type: "person", label: `match-${i}`,
      })),
    );
    expect(m.searchNodes("match", { limit: 3 })).toHaveLength(3);
  });

  it("setNodeMeta merges patch into the existing meta object", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "p1", type: "person", label: "A", meta: { role: "eng" } },
    ]);
    const r = m.setNodeMeta("p1", { summary: "She wrote the agent." });
    expect(r.ok).toBe(true);
    expect(r.node.meta.summary).toBe("She wrote the agent.");
    expect(r.node.meta.role).toBe("eng");
    // File was rewritten — re-read should return the merged meta.
    const fresh = m.getNode("p1");
    expect(fresh.node.meta.summary).toBe("She wrote the agent.");
    expect(fresh.node.meta.role).toBe("eng");
  });

  it("setNodeMeta returns 404-shape when the id is unknown", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "p1", type: "person", label: "A" },
    ]);
    const r = m.setNodeMeta("ghost", { summary: "boo" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not found");
  });

  it("setNodeMeta clears keys whose patch value is null", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "p1", type: "person", label: "A", meta: { summary: "old", role: "eng" } },
    ]);
    const r = m.setNodeMeta("p1", { summary: null });
    expect(r.ok).toBe(true);
    expect(r.node.meta.summary).toBeUndefined();
    expect(r.node.meta.role).toBe("eng");
  });

  it("setNodeMeta preserves edges and other nodes verbatim", async () => {
    const m = await import(kgPath + `?cb=${Date.now()}`);
    _writeFixture([
      { kind: "node", id: "p1", type: "person", label: "A" },
      { kind: "node", id: "p2", type: "person", label: "B" },
      { kind: "edge", from: "p1", to: "p2", label: "knows" },
    ]);
    m.setNodeMeta("p1", { summary: "test" });
    const stats = m.getStats();
    expect(stats.nodes).toBe(2);
    expect(stats.edges).toBe(1);
    const fresh = m.getNode("p2");
    expect(fresh.node.label).toBe("B");
  });
});
