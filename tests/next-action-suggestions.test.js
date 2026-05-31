// Phase Q-pass-5 P0-1 — next-action suggestion tests.
import { describe, it, expect } from "vitest";
import { suggestNextActions } from "../lib/next-action-suggestions.js";

describe("next-action-suggestions", () => {
  it("emits a deep-dive chip when problem + vendor are both mentioned", () => {
    const r = suggestNextActions({
      assistantText: "VENDOR1 MetricA is at 4.74% — critical, well above the 1.84% target.",
      userText: "Show portfolio status",
      toolNames: [],
    });
    expect(r[0]).toMatch(/Deep dive VENDOR1/);
  });

  it("emits a next-vendor chip when 2+ vendors mentioned", () => {
    const r = suggestNextActions({
      assistantText: "VENDOR1 is on track. VENDOR4 has a metric gap.",
      userText: "give me the portfolio",
      toolNames: [],
    });
    // Either chip mentions VENDOR4 (the second vendor).
    expect(r.some((c) => c.includes("VENDOR4"))).toBe(true);
  });

  it("includes a save-as-skill chip when ≥3 tools fired", () => {
    const r = suggestNextActions({
      assistantText: "Done.",
      userText: "Run the WBR.",
      toolNames: ["a", "b", "c", "d"],
    });
    expect(r.some((c) => c.toLowerCase().includes("skill"))).toBe(true);
  });

  it("falls back to seeded chips when nothing salient", () => {
    const r = suggestNextActions({
      assistantText: "Good morning.",
      userText: "hi",
      toolNames: [],
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[r.length - 1]).toBe("Something else");
  });

  it("respects the max parameter", () => {
    const r = suggestNextActions({
      assistantText: "VENDOR1 VENDOR4 VENDOR5 are red on MetricA + MetricB + Deal Ops.",
      userText: "all vendors deep dive",
      toolNames: ["a", "b", "c"],
      max: 2,
    });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("always closes with 'Something else' when chips were generated", () => {
    const r = suggestNextActions({
      assistantText: "VENDOR1 MetricA is critical at 4.7%.",
      userText: "status",
      toolNames: [],
    });
    expect(r[r.length - 1]).toBe("Something else");
  });
});
