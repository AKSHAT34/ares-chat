// Phase U19 — `ares kiro migrate` tests.
//
// We isolate via tmp $HOME — the migrate code reads ~/.kiro and writes
// ~/.ares (or ARES_PERSONA_DIR). Each test builds a fake ~/.kiro tree.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let TMP_HOME, TMP_ARES, prevHome, prevAres;

beforeEach(() => {
  prevHome = process.env.HOME;
  prevAres = process.env.ARES_PERSONA_DIR;
  TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ares-kiro-mig-"));
  TMP_ARES = path.join(TMP_HOME, "ares-target");
  process.env.HOME = TMP_HOME;
  process.env.ARES_PERSONA_DIR = TMP_ARES;
  // Build a fake ~/.kiro tree.
  fs.mkdirSync(path.join(TMP_HOME, ".kiro", "steering"), { recursive: true });
  fs.writeFileSync(path.join(TMP_HOME, ".kiro", "steering", "rule-a.md"), "# rule a");
  fs.writeFileSync(path.join(TMP_HOME, ".kiro", "steering", "rule-b.md"), "# rule b");
  fs.mkdirSync(path.join(TMP_HOME, ".kiro", "skills", "learned"), { recursive: true });
  fs.writeFileSync(path.join(TMP_HOME, ".kiro", "skills", "learned", "deep-dive.md"), "# deep-dive recipe");
  fs.mkdirSync(path.join(TMP_HOME, ".kiro", "memory"), { recursive: true });
  fs.writeFileSync(path.join(TMP_HOME, ".kiro", "memory", "journal.md"), "# kiro journal\n- entry 1");
  fs.writeFileSync(path.join(TMP_HOME, ".kiro", "memory", "preferences.json"), '{"likes":"terse"}');
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
  if (prevAres === undefined) delete process.env.ARES_PERSONA_DIR; else process.env.ARES_PERSONA_DIR = prevAres;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch {}
});

async function loadFresh() {
  return await import("../lib/cli/kiro-migrate.js");
}

describe("kiro-migrate — happy path", () => {
  it("copies steering + skills, creates MEMORY.md from journal, copies preferences", async () => {
    const m = await loadFresh();
    const r = m.runKiroMigrate({ log: () => {} });
    expect(r.sections.steering.copied).toBe(2);
    expect(r.sections.skills.copied).toBe(1);
    expect(r.sections.journal.action).toBe("created");
    expect(r.sections.preferences.action).toBe("copied");
    expect(fs.existsSync(path.join(TMP_ARES, "steering", "rule-a.md"))).toBe(true);
    expect(fs.existsSync(path.join(TMP_ARES, "steering", "rule-b.md"))).toBe(true);
    expect(fs.existsSync(path.join(TMP_ARES, "skills", "learned", "deep-dive.md"))).toBe(true);
    expect(fs.readFileSync(path.join(TMP_ARES, "MEMORY.md"), "utf8")).toContain("kiro journal");
    expect(fs.readFileSync(path.join(TMP_ARES, "preferences.json"), "utf8")).toContain("terse");
  });

  it("dry-run touches no files", async () => {
    const m = await loadFresh();
    const r = m.runKiroMigrate({ dryRun: true, log: () => {} });
    expect(r.sections.steering.copied).toBe(2); // counts what would be copied
    expect(fs.existsSync(path.join(TMP_ARES, "steering", "rule-a.md"))).toBe(false);
    expect(fs.existsSync(path.join(TMP_ARES, "MEMORY.md"))).toBe(false);
  });
});

describe("kiro-migrate — idempotency / overwrite", () => {
  it("re-running without --overwrite skips already-imported files", async () => {
    const m = await loadFresh();
    m.runKiroMigrate({ log: () => {} });
    // Mutate the destination to confirm second run doesn't clobber.
    fs.writeFileSync(path.join(TMP_ARES, "steering", "rule-a.md"), "# user-edited");
    const r2 = m.runKiroMigrate({ log: () => {} });
    expect(r2.sections.steering.copied).toBe(0);
    expect(r2.sections.steering.skipped).toBe(2);
    expect(fs.readFileSync(path.join(TMP_ARES, "steering", "rule-a.md"), "utf8")).toContain("user-edited");
  });

  it("re-running with --overwrite replaces existing files", async () => {
    const m = await loadFresh();
    m.runKiroMigrate({ log: () => {} });
    fs.writeFileSync(path.join(TMP_ARES, "steering", "rule-a.md"), "# user-edited");
    const r2 = m.runKiroMigrate({ overwrite: true, log: () => {} });
    expect(r2.sections.steering.copied).toBe(2);
    expect(fs.readFileSync(path.join(TMP_ARES, "steering", "rule-a.md"), "utf8")).toContain("rule a");
  });

  it("journal append leaves an idempotent marker so re-runs skip", async () => {
    const m = await loadFresh();
    // Pre-create a MEMORY.md so the journal copy uses the append branch.
    fs.mkdirSync(TMP_ARES, { recursive: true });
    fs.writeFileSync(path.join(TMP_ARES, "MEMORY.md"), "# my notes\n");
    const r1 = m.runKiroMigrate({ log: () => {} });
    expect(r1.sections.journal.action).toBe("appended");
    const r2 = m.runKiroMigrate({ log: () => {} });
    expect(r2.sections.journal.action).toBe("skip");
    expect(r2.sections.journal.reason).toMatch(/already imported/);
  });
});

describe("kiro-migrate — missing source", () => {
  it("returns an error section when ~/.kiro doesn't exist", async () => {
    fs.rmSync(path.join(TMP_HOME, ".kiro"), { recursive: true, force: true });
    const m = await loadFresh();
    const r = m.runKiroMigrate({ log: () => {} });
    expect(r.sections.error).toBeDefined();
  });
});
