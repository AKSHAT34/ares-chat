// Phase U03 — ContextEngine behaviour tests.
//
// Locks in the inlined-in-agent.js compression logic before the extraction
// to lib/context/* so parity is guaranteed. Each test asserts a property
// the production strategy must keep across pressure levels — anchors
// survive, durable artefacts survive, tool_use ↔ tool_result invariants
// hold, large-block truncation kicks in at the right size.

import { describe, it, expect } from "vitest";
import {
  AnchorContextEngine,
  HeadTruncateContextEngine,
  makeContextEngine,
  listContextEngines,
} from "../lib/context/index.js";

// Build a synthetic transcript with N filler turns + named anchors so we
// can spot the survivors after compression.
function buildTranscript({ filler = 50, withDurable = false, withBigResult = false } = {}) {
  const msgs = [];
  msgs.push({ role: "user", content: "ORIGINAL_TASK" });
  for (let i = 0; i < filler; i++) {
    msgs.push({ role: "assistant", content: [{ type: "text", text: `f${i}` }] });
    msgs.push({ role: "user", content: `u${i}` });
  }
  if (withDurable) {
    msgs.push({
      role: "assistant",
      content: [
        { type: "text", text: "saving file" },
        { type: "tool_use", id: "tu-fs", name: "filesystem-agent__fs_write", input: { path: "/tmp/x", content: "y" } },
      ],
    });
    msgs.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu-fs", content: [{ type: "text", text: "wrote 1 byte" }] }],
    });
  }
  if (withBigResult) {
    msgs.push({
      role: "assistant",
      content: [
        { type: "text", text: "running query" },
        { type: "tool_use", id: "tu-query", name: "data-query-mcp__RunQuery", input: { operation: "execute_query" } },
      ],
    });
    msgs.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: "tu-query",
        content: [{ type: "text", text: "row,".repeat(2000) }],
      }],
    });
  }
  // The last 8 messages are always preserved (KEEP_RECENT_MESSAGES). Pad
  // a bit so we have a meaningful tail.
  for (let i = 0; i < 4; i++) {
    msgs.push({ role: "assistant", content: [{ type: "text", text: `tail-${i}` }] });
    msgs.push({ role: "user", content: `tail-u${i}` });
  }
  return msgs;
}

describe("AnchorContextEngine", () => {
  const engine = new AnchorContextEngine();

  it("name is 'anchor'", () => {
    expect(engine.name).toBe("anchor");
  });

  it("limits exposes Bedrock thresholds", () => {
    const l = engine.limits;
    expect(l.bedrockMax).toBe(200_000);
    expect(l.soft).toBe(65_000);
    expect(l.hard).toBe(80_000);
    expect(l.maxMessages).toBe(60);
    expect(l.keepRecent).toBe(8);
  });

  it("shouldCompress true above 60 messages", () => {
    const msgs = buildTranscript({ filler: 35 });
    expect(msgs.length).toBeGreaterThan(60);
    expect(engine.shouldCompress(msgs)).toBe(true);
  });

  it("shouldCompress false on tiny transcripts", () => {
    expect(engine.shouldCompress([{ role: "user", content: "hi" }])).toBe(false);
  });

  it("estimateTokens grows with content size", () => {
    const small = engine.estimateTokens([{ role: "user", content: "hi" }]);
    const big = engine.estimateTokens([{ role: "user", content: "x".repeat(10_000) }]);
    expect(big).toBeGreaterThan(small * 100);
  });

  it("compress at pressure 0 keeps the last KEEP_RECENT_MESSAGES verbatim", () => {
    const msgs = buildTranscript({ filler: 60 });
    const out = engine.compress(msgs, { pressure: 0 });
    // Last 8 messages must be byte-identical.
    const tail = msgs.slice(-8);
    const outTail = out.slice(-8);
    expect(outTail).toEqual(tail);
  });

  it("compress at pressure 0 is a no-op when count <= MAX_MESSAGES_BEFORE_COMPRESS", () => {
    const small = buildTranscript({ filler: 5 });
    expect(small.length).toBeLessThanOrEqual(60);
    const out = engine.compress(small, { pressure: 0 });
    expect(out).toBe(small); // identity
  });

  it("compress reduces total message count on a long transcript", () => {
    const msgs = buildTranscript({ filler: 60 });
    const out = engine.compress(msgs, { pressure: 0 });
    expect(out.length).toBeLessThan(msgs.length);
  });

  it("compress preserves durable-artefact assistant turns (fs_write) verbatim", () => {
    const msgs = buildTranscript({ filler: 60, withDurable: true });
    const out = engine.compress(msgs, { pressure: 0 });
    // The fs_write tool_use must still appear in the output.
    const hasFsWrite = out.some((m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === "tool_use" && b.name === "filesystem-agent__fs_write")
    );
    expect(hasFsWrite).toBe(true);
  });

  it("compress preserves the matching tool_result alongside its tool_use", () => {
    const msgs = buildTranscript({ filler: 60, withDurable: true });
    const out = engine.compress(msgs, { pressure: 0 });
    // Find the fs_write tool_use index and confirm the next message has the matching tool_result.
    let useIdx = -1;
    for (let i = 0; i < out.length; i++) {
      const m = out[i];
      if (Array.isArray(m.content) && m.content.some((b) => b.type === "tool_use" && b.id === "tu-fs")) {
        useIdx = i;
        break;
      }
    }
    expect(useIdx).toBeGreaterThan(-1);
    const next = out[useIdx + 1];
    expect(next.role).toBe("user");
    expect(next.content.some((b) => b.type === "tool_result" && b.tool_use_id === "tu-fs")).toBe(true);
  });

  it("compress preserves assistant turns with big tool_results (>2KB) at pressure 0", () => {
    const msgs = buildTranscript({ filler: 60, withBigResult: true });
    const out = engine.compress(msgs, { pressure: 0 });
    const hasBigResult = out.some((m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === "tool_result" && b.tool_use_id === "tu-query")
    );
    expect(hasBigResult).toBe(true);
  });

  it("compress emits synthetic <context_summary> messages for filler runs", () => {
    const msgs = buildTranscript({ filler: 60 });
    const out = engine.compress(msgs, { pressure: 0 });
    const hasSummary = out.some((m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === "text" && b.text.includes("<context_summary"))
    );
    expect(hasSummary).toBe(true);
  });

  it("synthetic summary alternates roles correctly (no two same-role in a row)", () => {
    const msgs = buildTranscript({ filler: 60, withDurable: true });
    const out = engine.compress(msgs, { pressure: 0 });
    // The summaries pick role based on the previous message — confirm no
    // adjacent same-role pair exists in the compressed output where both
    // sides are summaries.
    for (let i = 1; i < out.length; i++) {
      if (out[i - 1].role === out[i].role) {
        // Same-role can happen for tool_result-bearing user messages
        // adjacent to plain user. That's only legal if at least one side
        // is genuine (not a synthetic summary).
        const aSummary = Array.isArray(out[i - 1].content) && out[i - 1].content[0]?.text?.startsWith("<context_summary");
        const bSummary = Array.isArray(out[i].content) && out[i].content[0]?.text?.startsWith("<context_summary");
        expect(aSummary && bSummary).toBe(false);
      }
    }
  });

  it("compress at higher pressure keeps fewer recent user turns as anchors", () => {
    const msgs = buildTranscript({ filler: 60 });
    const lo = engine.compress(msgs, { pressure: 0 });
    const hi = engine.compress(msgs, { pressure: 2 });
    // Higher pressure should reduce or hold the surviving message count.
    expect(hi.length).toBeLessThanOrEqual(lo.length);
  });

  it("truncateLargeToolResults shortens >8KB tool_result text blocks", () => {
    const big = "x".repeat(20_000);
    const msgs = [
      { role: "user", content: "go" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "x", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: big }] },
    ];
    const out = engine.truncateLargeToolResults(msgs);
    const tr = out[2].content[0];
    expect(tr.content).toContain("[truncated");
    expect(tr.content.length).toBeLessThan(big.length);
  });

  it("truncateLargeToolResults shortens >8KB inline file text blocks", () => {
    const big = "<file name=\"data.csv\">" + "row\n".repeat(5000) + "</file>";
    const msgs = [{ role: "user", content: [{ type: "text", text: big }] }];
    const out = engine.truncateLargeToolResults(msgs);
    const block = out[0].content[0];
    expect(block.text).toContain("[truncated");
    expect(block.text.length).toBeLessThan(big.length);
  });

  it("truncateLargeToolResults leaves small blocks untouched (returns same object)", () => {
    const msgs = [{ role: "user", content: [{ type: "text", text: "small" }] }];
    const out = engine.truncateLargeToolResults(msgs);
    // Caller relies on this object-identity: the agent compares
    // mutated vs unmutated to know whether to spend cycles re-sanitising.
    expect(out[0]).toBe(msgs[0]);
  });

  it("hardTruncate keeps first user + last 8 with a marker between", () => {
    const msgs = buildTranscript({ filler: 60 });
    const before = msgs.length;
    const out = engine.hardTruncate(msgs);
    expect(out.length).toBe(1 + 1 + 8);
    expect(out[0]).toBe(msgs[0]); // first user turn
    expect(out[1].role).toBe("assistant");
    expect(out[1].content[0].text).toContain("<context_summary truncated=\"hard\">");
    expect(out[1].content[0].text).toContain(`Dropped ${before - 1 - 8}`);
    // Tail identity — last 8 messages must be the same objects.
    expect(out.slice(-8)).toEqual(msgs.slice(-8));
  });

  it("hardTruncate is a no-op when transcript is already short", () => {
    const small = [{ role: "user", content: "hi" }];
    expect(engine.hardTruncate(small)).toBe(small);
  });
});

describe("HeadTruncateContextEngine", () => {
  const engine = new HeadTruncateContextEngine();

  it("name is 'head-truncate'", () => {
    expect(engine.name).toBe("head-truncate");
  });

  it("compress collapses to first + marker + last 8", () => {
    const msgs = [];
    for (let i = 0; i < 30; i++) {
      msgs.push({ role: "user", content: `m${i}` });
    }
    const out = engine.compress(msgs);
    expect(out.length).toBe(1 + 1 + 8);
    expect(out[0]).toBe(msgs[0]);
    expect(out[1].content[0].text).toContain("<context_summary truncated=\"hard\">");
  });
});

describe("makeContextEngine factory", () => {
  it("default is anchor", () => {
    const e = makeContextEngine();
    expect(e.name).toBe("anchor");
  });

  it("explicit head-truncate works", () => {
    const e = makeContextEngine("head-truncate");
    expect(e.name).toBe("head-truncate");
  });

  it("unknown engine falls back to anchor without throwing", () => {
    const e = makeContextEngine("does-not-exist");
    expect(e.name).toBe("anchor");
  });

  it("listContextEngines reports both built-ins", () => {
    const names = listContextEngines();
    expect(names).toContain("anchor");
    expect(names).toContain("head-truncate");
  });
});
