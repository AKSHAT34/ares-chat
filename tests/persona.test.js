// Phase U12 — structured memory files (SOUL/USER/MEMORY) tests.
//
// We isolate via ARES_PERSONA_DIR = a fresh tmpdir per test so the real
// ~/.ares/ stays untouched. The module reads the env var on every call.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let TMP;
let prevDir;

beforeEach(() => {
  prevDir = process.env.ARES_PERSONA_DIR;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ares-persona-"));
  process.env.ARES_PERSONA_DIR = TMP;
});

afterEach(() => {
  if (prevDir === undefined) delete process.env.ARES_PERSONA_DIR;
  else process.env.ARES_PERSONA_DIR = prevDir;
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
});

// The persona module re-reads ARES_PERSONA_DIR on every call, so a single
// shared import is fine — the env var swap in beforeEach takes effect.
const personaModP = import("../lib/persona.js");
async function loadFresh() {
  return personaModP;
}

describe("persona — readPersonaFiles", () => {
  it("seeds SOUL/USER/MEMORY when missing", async () => {
    const m = await loadFresh();
    const r = m.readPersonaFiles({ log: () => {} });
    expect(r.touched).toBe(true);
    expect(r.soul.length).toBeGreaterThan(50);
    expect(r.user.length).toBeGreaterThan(20);
    expect(r.memory.length).toBeGreaterThan(20);
    for (const name of ["SOUL.md", "USER.md", "MEMORY.md"]) {
      expect(fs.existsSync(path.join(TMP, name))).toBe(true);
    }
  });

  it("does NOT overwrite existing non-empty content on re-read", async () => {
    fs.writeFileSync(path.join(TMP, "SOUL.md"), "# my custom soul\nI am terse.");
    fs.writeFileSync(path.join(TMP, "USER.md"), "# User\n- prefers JSON output");
    fs.writeFileSync(path.join(TMP, "MEMORY.md"), "# notes\n- WBR every Friday");
    const m = await loadFresh();
    const r1 = m.readPersonaFiles({ log: () => {} });
    expect(r1.soul).toContain("my custom soul");
    expect(r1.user).toContain("prefers JSON output");
    expect(r1.memory).toContain("WBR every Friday");
    expect(r1.touched).toBe(false);

    // Second read — files unchanged on disk too.
    const before = fs.readFileSync(path.join(TMP, "SOUL.md"), "utf8");
    m.readPersonaFiles({ log: () => {} });
    const after = fs.readFileSync(path.join(TMP, "SOUL.md"), "utf8");
    expect(after).toBe(before);
  });

  it("re-seeds an empty file (truncate(0) recovery)", async () => {
    fs.writeFileSync(path.join(TMP, "USER.md"), "");
    const m = await loadFresh();
    const r = m.readPersonaFiles({ log: () => {} });
    expect(r.user.length).toBeGreaterThan(20);
    expect(r.touched).toBe(true);
  });

  it("returns the correct paths object", async () => {
    const m = await loadFresh();
    const r = m.readPersonaFiles({ log: () => {} });
    expect(r.paths.SOUL).toBe(path.join(TMP, "SOUL.md"));
    expect(r.paths.USER).toBe(path.join(TMP, "USER.md"));
    expect(r.paths.MEMORY).toBe(path.join(TMP, "MEMORY.md"));
  });
});

describe("persona — buildPersonaBlock", () => {
  it("emits <persona>/<user_model>/<notes> tagged regions when content exists", async () => {
    const m = await loadFresh();
    const block = m.buildPersonaBlock({ log: () => {} });
    expect(block).toMatch(/<persona file=".+SOUL\.md">/);
    expect(block).toMatch(/<\/persona>/);
    expect(block).toMatch(/<user_model file=".+USER\.md">/);
    expect(block).toMatch(/<\/user_model>/);
    expect(block).toMatch(/<notes file=".+MEMORY\.md">/);
    expect(block).toMatch(/<\/notes>/);
  });

  it("preserves user content inside the tags", async () => {
    fs.writeFileSync(path.join(TMP, "SOUL.md"), "# my soul\nbe brief");
    fs.writeFileSync(path.join(TMP, "USER.md"), "# user\n- terse outputs");
    fs.writeFileSync(path.join(TMP, "MEMORY.md"), "# notes\n- ship U12");
    const m = await loadFresh();
    const block = m.buildPersonaBlock({ log: () => {} });
    expect(block).toContain("be brief");
    expect(block).toContain("terse outputs");
    expect(block).toContain("ship U12");
  });

  it("file mode 0600 enforced on seeded files", async () => {
    const m = await loadFresh();
    m.readPersonaFiles({ log: () => {} });
    const stat = fs.statSync(path.join(TMP, "SOUL.md"));
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe("persona — system prompt integration", () => {
  it("buildSystemPrompt embeds the persona block", async () => {
    fs.writeFileSync(path.join(TMP, "SOUL.md"), "# soul\nDistinctive marker: SOUL_FROM_TEST");
    const sp = await import("../lib/system-prompt.js");
    const prompt = await sp.buildSystemPrompt({
      workspaceRoot: "/tmp/non-existent-workspace",
      mcpCatalog: "",
      log: () => {},
    });
    expect(prompt).toContain("SOUL_FROM_TEST");
    expect(prompt).toMatch(/<persona file=".+SOUL\.md">/);
  });
});
