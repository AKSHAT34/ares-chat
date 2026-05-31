// Phase 10 — unit tests for lib/resource-hygiene.js.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  gcOrphanUploads,
  gcOrphanCheckpoints,
  gcBakCruft,
  runHygienePass,
} from "../lib/resource-hygiene.js";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ares-hygiene-"));
  const sessions = path.join(root, "sessions");
  const uploads = path.join(root, "uploads");
  const checkpoints = path.join(root, "checkpoints");
  const src = path.join(root, "src");
  for (const d of [sessions, uploads, checkpoints, src]) mkdirSync(d, { recursive: true });
  return { root, sessions, uploads, checkpoints, src };
}

describe("gcOrphanUploads", () => {
  let f;
  beforeEach(() => { f = fixture(); });
  afterEach(() => rmSync(f.root, { recursive: true, force: true }));

  it("removes uploads dirs whose session no longer exists", () => {
    writeFileSync(path.join(f.sessions, "live.json"), "{}");
    mkdirSync(path.join(f.uploads, "live"), { recursive: true });
    writeFileSync(path.join(f.uploads, "live", "x"), "x");
    mkdirSync(path.join(f.uploads, "ghost"), { recursive: true });
    writeFileSync(path.join(f.uploads, "ghost", "x"), "x");

    const r = gcOrphanUploads({ uploadsRoot: f.uploads, sessionsDir: f.sessions });
    expect(r.scanned).toBe(2);
    expect(r.removed).toBe(1);
    expect(existsSync(path.join(f.uploads, "ghost"))).toBe(false);
    expect(existsSync(path.join(f.uploads, "live"))).toBe(true);
  });

  it("preserves the unassigned/ directory", () => {
    mkdirSync(path.join(f.uploads, "unassigned"), { recursive: true });
    writeFileSync(path.join(f.uploads, "unassigned", "x"), "x");
    const r = gcOrphanUploads({ uploadsRoot: f.uploads, sessionsDir: f.sessions });
    expect(r.removed).toBe(0);
    expect(existsSync(path.join(f.uploads, "unassigned"))).toBe(true);
  });

  it("counts freed bytes", () => {
    mkdirSync(path.join(f.uploads, "big"), { recursive: true });
    writeFileSync(path.join(f.uploads, "big", "f"), "x".repeat(2048));
    const r = gcOrphanUploads({ uploadsRoot: f.uploads, sessionsDir: f.sessions });
    expect(r.freedBytes).toBeGreaterThanOrEqual(2048);
  });

  it("returns zeros when uploadsRoot doesn't exist", () => {
    const r = gcOrphanUploads({ uploadsRoot: "/no/such/dir", sessionsDir: f.sessions });
    expect(r).toEqual({ scanned: 0, removed: 0, freedBytes: 0 });
  });
});

describe("gcOrphanCheckpoints", () => {
  let f;
  beforeEach(() => { f = fixture(); });
  afterEach(() => rmSync(f.root, { recursive: true, force: true }));

  it("removes checkpoints with no matching session", () => {
    writeFileSync(path.join(f.sessions, "live.json"), "{}");
    writeFileSync(path.join(f.checkpoints, "live.json"), "{}");
    writeFileSync(path.join(f.checkpoints, "ghost.json"), "{}");
    const r = gcOrphanCheckpoints({ checkpointsDir: f.checkpoints, sessionsDir: f.sessions });
    expect(r.scanned).toBe(2);
    expect(r.removed).toBe(1);
    expect(existsSync(path.join(f.checkpoints, "ghost.json"))).toBe(false);
    expect(existsSync(path.join(f.checkpoints, "live.json"))).toBe(true);
  });
});

describe("gcBakCruft", () => {
  let f;
  beforeEach(() => { f = fixture(); });
  afterEach(() => rmSync(f.root, { recursive: true, force: true }));

  it("removes old .bak files but preserves recent ones", () => {
    const oldBak = path.join(f.src, "x.js.bak");
    const newBak = path.join(f.src, "y.js.bak");
    writeFileSync(oldBak, "old");
    writeFileSync(newBak, "new");
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    utimesSync(oldBak, longAgo, longAgo);

    const r = gcBakCruft({ root: f.src });
    expect(r.removed).toBe(1);
    expect(existsSync(oldBak)).toBe(false);
    expect(existsSync(newBak)).toBe(true);
  });

  it("removes timestamped .bak.YYYYMMDD-HHMMSS files", () => {
    const oldBak = path.join(f.src, "x.js.bak.20260101-000000");
    writeFileSync(oldBak, "x");
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    utimesSync(oldBak, longAgo, longAgo);
    const r = gcBakCruft({ root: f.src });
    expect(r.removed).toBe(1);
  });

  it("removes editor tilde files", () => {
    const tilde = path.join(f.src, "x.js~");
    writeFileSync(tilde, "x");
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    utimesSync(tilde, longAgo, longAgo);
    const r = gcBakCruft({ root: f.src });
    expect(r.removed).toBe(1);
  });

  it("skips node_modules", () => {
    const nm = path.join(f.src, "node_modules");
    mkdirSync(nm);
    const bak = path.join(nm, "lib.js.bak");
    writeFileSync(bak, "x");
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    utimesSync(bak, longAgo, longAgo);
    const r = gcBakCruft({ root: f.src });
    expect(r.removed).toBe(0);
    expect(existsSync(bak)).toBe(true);
  });
});

describe("runHygienePass", () => {
  let f;
  beforeEach(() => { f = fixture(); });
  afterEach(() => rmSync(f.root, { recursive: true, force: true }));

  it("runs all three passes and returns a summary", () => {
    const log = [];
    const r = runHygienePass({
      rootDir: f.root,
      sessionsDir: f.sessions,
      checkpointsDir: f.checkpoints,
      uploadsRoot: f.uploads,
      log: (s) => log.push(s),
    });
    expect(r.uploads).toBeDefined();
    expect(r.checkpoints).toBeDefined();
    expect(r.bak).toBeDefined();
    expect(log.length).toBeGreaterThan(0);
  });
});
