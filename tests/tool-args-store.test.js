// Phase RP1-B3 — persistent store: load, candidate → promotion, reload.

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ToolArgStore, applyFixesFromStore } from "../lib/tool-args/store.js";

function freshStore() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ares-tas-"));
  const file = path.join(tmp, "fixes.jsonl");
  return { tmp, file, store: new ToolArgStore({ filePath: file }) };
}

describe("ToolArgStore — seed + load", () => {
  it("seeds the file on first load when missing", () => {
    const { store, file } = freshStore();
    store.load();
    const contents = readFileSync(file, "utf8");
    expect(contents).toMatch(/data-query-mcp__execute_query/);
    expect(contents).toMatch(/data_query_mcp_user_context/);
  });

  it("reloads and only returns promoted entries from fixesFor()", () => {
    const { store } = freshStore();
    store.load();
    const fixes = store.fixesFor("data-query-mcp__execute_query");
    expect(fixes.length).toBe(1);
    expect(fixes[0].promoted).toBe(true);
  });

  it("fixesFor returns nothing for unknown tools", () => {
    const { store } = freshStore();
    store.load();
    expect(store.fixesFor("unknown__tool")).toEqual([]);
  });
});

describe("applyFixesFromStore — pre-flight", () => {
  it("injects data_query_mcp_user_context when missing", () => {
    const { store } = freshStore();
    store.load();
    const r = applyFixesFromStore(store, "data-query-mcp__execute_query", { sql: "select 1" });
    expect(r.applied.length).toBe(1);
    expect(r.args.data_query_mcp_user_context).toEqual({ requester: "ares-chat" });
    expect(r.args.sql).toBe("select 1");
  });

  it("does NOT overwrite a user-provided data_query_mcp_user_context", () => {
    const { store } = freshStore();
    store.load();
    const userVal = { requester: "user-chosen" };
    const r = applyFixesFromStore(store, "data-query-mcp__execute_query",
      { sql: "select 1", data_query_mcp_user_context: userVal });
    expect(r.applied.length).toBe(0);
    expect(r.args.data_query_mcp_user_context).toEqual(userVal);
  });

  it("returns args unchanged for tools with no matching fixes", () => {
    const { store } = freshStore();
    store.load();
    const original = { foo: 1 };
    const r = applyFixesFromStore(store, "no-such-tool", original);
    expect(r.args).toEqual(original);
    expect(r.applied).toEqual([]);
  });
});

describe("ToolArgStore — candidate → promotion", () => {
  it("promotes a candidate to live fix after 3 successes", () => {
    const { store } = freshStore();
    store.load();
    const initialPromoted = store.fixesFor("foo__bar").length;
    store.recordCandidate({
      toolName: "foo__bar",
      errorRegex: "missing.*x",
      transform: 'inject:x="default"',
    });
    // Still unpromoted — fixesFor() filters them out.
    expect(store.fixesFor("foo__bar").length).toBe(initialPromoted);

    // 3 successes should flip the promoted flag.
    store.recordSuccess({ toolName: "foo__bar", transform: 'inject:x="default"' });
    store.recordSuccess({ toolName: "foo__bar", transform: 'inject:x="default"' });
    store.recordSuccess({ toolName: "foo__bar", transform: 'inject:x="default"' });
    const fixes = store.fixesFor("foo__bar");
    expect(fixes.length).toBe(initialPromoted + 1);
    const promoted = fixes.find((e) => e.transform === 'inject:x="default"');
    expect(promoted).toBeTruthy();
    expect(promoted.successes).toBe(3);
  });

  it("recordCandidate is idempotent — same triple doesn't duplicate", () => {
    const { store } = freshStore();
    store.load();
    store.recordCandidate({ toolName: "foo__bar", errorRegex: "x", transform: 'inject:y="z"' });
    store.recordCandidate({ toolName: "foo__bar", errorRegex: "x", transform: 'inject:y="z"' });
    const matching = store.entries.filter((e) =>
      e.toolName === "foo__bar" && e.transform === 'inject:y="z"');
    expect(matching.length).toBe(1);
  });
});

describe("ToolArgStore — manual edit + reload", () => {
  it("re-reads the file on noteCall when threshold hits", () => {
    const { store, file } = freshStore();
    store.load();
    expect(store.fixesFor("manual__add").length).toBe(0);

    // Simulate a hand edit: append a new promoted entry.
    const newEntry = {
      toolName: "manual__add",
      errorRegex: "anything",
      transform: 'inject:foo="bar"',
      promoted: true,
      applications: 0,
      successes: 0,
      addedAt: Date.now(),
      lastSuccessAt: 0,
    };
    writeFileSync(file, readFileSync(file, "utf8") + JSON.stringify(newEntry) + "\n");

    // Burn through 50 calls so the reload triggers.
    for (let i = 0; i < 50; i++) store.noteCall();

    expect(store.fixesFor("manual__add").length).toBe(1);
  });
});
