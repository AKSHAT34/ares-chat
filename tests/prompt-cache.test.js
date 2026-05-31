// Phase U04 — Bedrock prompt-cache tests.
//
// Locks in the stamping shape, the auto-disable path on cache_control
// rejection, and the metric counters that downstream dashboards depend on.

import { describe, it, expect, beforeEach } from "vitest";
import * as cache from "../lib/llm/prompt-cache.js";
import { snapshotJson } from "../lib/observability.js";

beforeEach(() => {
  delete process.env.ARES_PROMPT_CACHE;
  cache._resetForTests();
});

describe("prompt-cache: stampSystem", () => {
  it("converts a non-empty string into a single text block with cache_control", () => {
    const out = cache.stampSystem("hello world");
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "text",
      text: "hello world",
      cache_control: { type: "ephemeral" },
    });
  });

  it("returns the raw input untouched when cache is disabled", () => {
    process.env.ARES_PROMPT_CACHE = "off";
    cache._resetForTests();
    const out = cache.stampSystem("hello");
    expect(out).toBe("hello");
  });

  it("returns input unchanged when system is already an array", () => {
    const arr = [{ type: "text", text: "x" }];
    expect(cache.stampSystem(arr)).toBe(arr);
  });

  it("returns input unchanged on falsy input", () => {
    expect(cache.stampSystem("")).toBe("");
    expect(cache.stampSystem(null)).toBe(null);
    expect(cache.stampSystem(undefined)).toBe(undefined);
  });
});

describe("prompt-cache: stampTools", () => {
  it("stamps cache_control on the LAST tool only", () => {
    const tools = [
      { name: "a", input_schema: {} },
      { name: "b", input_schema: {} },
      { name: "c", input_schema: {} },
    ];
    const out = cache.stampTools(tools);
    expect(out).toHaveLength(3);
    expect(out[0].cache_control).toBeUndefined();
    expect(out[1].cache_control).toBeUndefined();
    expect(out[2].cache_control).toEqual({ type: "ephemeral" });
  });

  it("does not mutate the caller's array", () => {
    const tools = [{ name: "a" }, { name: "b" }];
    const before = JSON.stringify(tools);
    cache.stampTools(tools);
    expect(JSON.stringify(tools)).toBe(before);
  });

  it("returns input unchanged when caching disabled", () => {
    process.env.ARES_PROMPT_CACHE = "off";
    cache._resetForTests();
    const tools = [{ name: "a" }];
    expect(cache.stampTools(tools)).toBe(tools);
  });

  it("returns empty array unchanged", () => {
    const tools = [];
    expect(cache.stampTools(tools)).toBe(tools);
  });

  it("does not double-stamp an already-stamped last tool", () => {
    const tools = [
      { name: "a" },
      { name: "b", cache_control: { type: "ephemeral" } },
    ];
    const out = cache.stampTools(tools);
    expect(out).toBe(tools);
  });
});

describe("prompt-cache: cacheStatus + setEnabled", () => {
  it("default mode is auto, enabled=true", () => {
    const s = cache.cacheStatus();
    expect(s.mode).toBe("auto");
    expect(s.enabled).toBe(true);
  });

  it("ARES_PROMPT_CACHE=off disables at boot", () => {
    process.env.ARES_PROMPT_CACHE = "off";
    cache._resetForTests();
    const s = cache.cacheStatus();
    expect(s.mode).toBe("off");
    expect(s.enabled).toBe(false);
  });

  it("ARES_PROMPT_CACHE=on stays on", () => {
    process.env.ARES_PROMPT_CACHE = "on";
    cache._resetForTests();
    expect(cache.cacheStatus().enabled).toBe(true);
  });

  it("unknown env value falls back to auto", () => {
    process.env.ARES_PROMPT_CACHE = "totally-bogus";
    cache._resetForTests();
    expect(cache.cacheStatus().mode).toBe("auto");
  });

  it("setEnabled(false, reason) flips runtime + records reason", () => {
    cache.setEnabled(false, "test-flip");
    const s = cache.cacheStatus();
    expect(s.enabled).toBe(false);
    expect(s.autoDisabledReason).toBe("test-flip");
  });
});

describe("prompt-cache: maybeAutoDisable", () => {
  it("flips off in auto mode when error mentions cache_control", () => {
    const flipped = cache.maybeAutoDisable(new Error("ValidationException: cache_control not supported"));
    expect(flipped).toBe(true);
    expect(cache.cacheStatus().enabled).toBe(false);
  });

  it("does NOT flip when mode is on (no auto-fallback in 'on' mode)", () => {
    process.env.ARES_PROMPT_CACHE = "on";
    cache._resetForTests();
    const flipped = cache.maybeAutoDisable(new Error("cache_control rejected"));
    expect(flipped).toBe(false);
    expect(cache.cacheStatus().enabled).toBe(true);
  });

  it("does NOT flip on unrelated errors", () => {
    const flipped = cache.maybeAutoDisable(new Error("ExpiredTokenException"));
    expect(flipped).toBe(false);
    expect(cache.cacheStatus().enabled).toBe(true);
  });

  it("returns false when already disabled (idempotent)", () => {
    cache.setEnabled(false, "prior");
    expect(cache.maybeAutoDisable(new Error("cache_control"))).toBe(false);
  });
});

describe("prompt-cache: recordUsage → metrics", () => {
  it("counts cache_read_input_tokens as a hit + accumulates the token total", () => {
    const before = snapshotJson().counters;
    const beforeHits = before.ares_prompt_cache_hits_total || 0;
    const beforeRead = before.ares_prompt_cache_read_tokens_total || 0;
    cache.recordUsage({ input_tokens: 50, cache_read_input_tokens: 12345 });
    const after = snapshotJson().counters;
    expect((after.ares_prompt_cache_hits_total || 0) - beforeHits).toBe(1);
    expect((after.ares_prompt_cache_read_tokens_total || 0) - beforeRead).toBe(12345);
  });

  it("counts cache_creation_input_tokens as creation tokens", () => {
    const before = snapshotJson().counters;
    const baseline = before.ares_prompt_cache_creation_tokens_total || 0;
    cache.recordUsage({ input_tokens: 50, cache_creation_input_tokens: 9000 });
    const after = snapshotJson().counters;
    expect((after.ares_prompt_cache_creation_tokens_total || 0) - baseline).toBe(9000);
  });

  it("a payload with neither read nor creation increments misses (cache enabled)", () => {
    cache._resetForTests();
    const before = snapshotJson().counters;
    const baseline = before.ares_prompt_cache_misses_total || 0;
    cache.recordUsage({ input_tokens: 50 });
    const after = snapshotJson().counters;
    expect((after.ares_prompt_cache_misses_total || 0) - baseline).toBe(1);
  });

  it("does NOT count misses when cache is disabled (off mode)", () => {
    process.env.ARES_PROMPT_CACHE = "off";
    cache._resetForTests();
    const before = snapshotJson().counters;
    const baseline = before.ares_prompt_cache_misses_total || 0;
    cache.recordUsage({ input_tokens: 50 });
    const after = snapshotJson().counters;
    expect((after.ares_prompt_cache_misses_total || 0) - baseline).toBe(0);
  });

  it("ignores null / wrong-shape input without throwing", () => {
    expect(() => cache.recordUsage(null)).not.toThrow();
    expect(() => cache.recordUsage(undefined)).not.toThrow();
    expect(() => cache.recordUsage("nope")).not.toThrow();
  });
});

describe("prompt-cache: isCacheControlRejection", () => {
  it("matches 'cache_control'", () => {
    expect(cache.isCacheControlRejection(new Error("Invalid cache_control field"))).toBe(true);
  });

  it("matches 'cache control'", () => {
    expect(cache.isCacheControlRejection(new Error("cache control not allowed"))).toBe(true);
  });

  it("matches 'prompt cache'", () => {
    expect(cache.isCacheControlRejection(new Error("Prompt cache disabled for this profile"))).toBe(true);
  });

  it("does NOT match unrelated errors", () => {
    expect(cache.isCacheControlRejection(new Error("ExpiredToken"))).toBe(false);
    expect(cache.isCacheControlRejection(null)).toBe(false);
  });
});
