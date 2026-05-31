// Q-pass-4 (E) — empty-state suggestion chips.
//
// Exercises lib/suggestions.js directly with a stub MCP hub so we don't
// need a live server. Covers:
//   - merging memory_smart_recall + skill_list + seeds
//   - 60-second TTL cache (hit + miss)
//   - graceful fallback to seeds when both sources fail

import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MOD = path.join(__dirname, "..", "lib", "suggestions.js");

function makeStubHub({ memory, skills, throwBoth = false } = {}) {
  return {
    callTool: async (name) => {
      if (throwBoth) throw new Error("offline");
      if (name === "memory__memory_smart_recall") {
        return { content: [{ type: "text", text: JSON.stringify({ hits: memory || [] }) }] };
      }
      if (name === "skills__skill_list") {
        return { content: [{ type: "text", text: JSON.stringify(skills || []) }] };
      }
      return { content: [{ type: "text", text: "{}" }] };
    },
  };
}

describe("Q-pass-4 (E) · suggestions cache + merge", () => {
  let mod;
  beforeEach(async () => {
    // Re-import the module fresh per test so the in-memory cache is
    // pristine. Vitest by default reuses module instances across tests
    // in the same file.
    mod = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    mod._clearCache();
  });

  it("merges memory + skill + seed entries with correct kinds", async () => {
    const hub = makeStubHub({
      memory: [
        { summary: "the example vendor onboarding draft for VENDOR6" },
        { summary: "dataset ARN approval poller for ProjectX" },
      ],
      skills: [
        { slug: "projectx-export", title: "ProjectX weekly export", run_count: 12 },
        { slug: "kpi-cache", title: "KPI cache rebuild", run_count: 8 },
        { slug: "cost-metrics", title: "COST_MetricB expiry sweep", run_count: 4 },
        { slug: "rare", title: "rare-task", run_count: 1 },
      ],
    });
    const r = await mod.getSuggestions({ hub });
    expect(r.cached).toBe(false);
    expect(r.suggestions.length).toBe(5);
    const kinds = r.suggestions.map((s) => s.kind);
    expect(kinds.filter((k) => k === "memory").length).toBeGreaterThan(0);
    expect(kinds.filter((k) => k === "skill").length).toBeGreaterThan(0);
    // Memory must come before seeds in priority.
    const firstSeed = kinds.indexOf("seed");
    const lastMemory = kinds.lastIndexOf("memory");
    if (firstSeed >= 0 && lastMemory >= 0) {
      expect(lastMemory).toBeLessThan(firstSeed);
    }
    // Skills must be ordered by run_count descending.
    const skillTexts = r.suggestions.filter((s) => s.kind === "skill").map((s) => s.text);
    expect(skillTexts[0]).toMatch(/ProjectX weekly export/);
  });

  it("returns the cached payload on a second call within the TTL", async () => {
    const hub = makeStubHub({
      memory: [{ summary: "topic A" }],
      skills: [{ title: "skill A", run_count: 5 }],
    });
    const a = await mod.getSuggestions({ hub });
    expect(a.cached).toBe(false);
    // Mutate the stub's data: a real second-call without cache would now
    // return different chips.
    const hub2 = makeStubHub({
      memory: [{ summary: "topic B" }],
      skills: [{ title: "skill B", run_count: 9 }],
    });
    const b = await mod.getSuggestions({ hub: hub2 });
    expect(b.cached).toBe(true);
    // Same payload as the first call, NOT the new hub's data.
    expect(b.suggestions).toEqual(a.suggestions);
  });

  it("re-fetches when the cache is cleared", async () => {
    const hub = makeStubHub({ memory: [], skills: [] });
    const a = await mod.getSuggestions({ hub });
    expect(a.cached).toBe(false);
    mod._clearCache();
    const b = await mod.getSuggestions({ hub });
    expect(b.cached).toBe(false);
  });

  it("falls back to seeds-only when both MCP calls throw", async () => {
    const hub = makeStubHub({ throwBoth: true });
    const r = await mod.getSuggestions({ hub });
    expect(r.suggestions.length).toBe(5);
    // Every entry is a seed.
    expect(r.suggestions.every((s) => s.kind === "seed")).toBe(true);
    // First chip is the canonical "What can Ares do?" prompt.
    expect(r.suggestions[0].text).toBe("What can Ares do?");
  });

  it("returns 5 chips even with no hub at all (server boot edge case)", async () => {
    const r = await mod.getSuggestions({ hub: null });
    expect(r.suggestions.length).toBe(5);
    expect(r.suggestions.every((s) => s.kind === "seed")).toBe(true);
  });
});
