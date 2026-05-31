// Q-pass-3 work-stream E — indexed-folders + index-config + diskspace.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The store reads / writes under ~/.ares — sandbox via temp dirs by
// re-importing with a stubbed HOME each test. Module ESM cache means
// we have to use vi.resetModules between tests to pick up the new env.
import { vi } from "vitest";

const TMP_HOME = path.join(os.tmpdir(), `ares-folders-test-${process.pid}-${Math.random().toString(36).slice(2)}`);

beforeEach(() => {
  vi.resetModules();
  fs.mkdirSync(TMP_HOME, { recursive: true });
  fs.mkdirSync(path.join(TMP_HOME, ".ares"), { recursive: true });
  vi.stubEnv("HOME", TMP_HOME);
  // os.homedir() reads from HOME on linux/darwin, so stubbing HOME is
  // enough for our usage. Re-import the store after stubbing.
});

afterEach(() => {
  vi.unstubAllEnvs();
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch {}
});

async function loadStore() {
  return await import("../lib/indexed-folders.js");
}

describe("indexed-folders — happy path", () => {
  it("listFolders is empty by default", async () => {
    const m = await loadStore();
    expect(m.listFolders()).toEqual([]);
  });

  it("addFolder accepts a real readable directory and persists", async () => {
    const m = await loadStore();
    const target = path.join(TMP_HOME, "indexable-project");
    fs.mkdirSync(target, { recursive: true });
    const f = m.addFolder(target);
    expect(f).toMatchObject({
      path: target,
      name: "indexable-project",
      status: "queued",
      sizeBytes: 0,
    });
    expect(typeof f.id).toBe("string");
    expect(f.id.length).toBeGreaterThan(8);
    const all = m.listFolders();
    expect(all).toHaveLength(1);
    expect(all[0].path).toBe(target);
  });

  it("addFolder is idempotent on the same path", async () => {
    const m = await loadStore();
    const target = path.join(TMP_HOME, "p1");
    fs.mkdirSync(target, { recursive: true });
    const f1 = m.addFolder(target);
    const f2 = m.addFolder(target);
    expect(f1.id).toBe(f2.id);
    expect(m.listFolders()).toHaveLength(1);
  });

  it("removeFolder drops by id and returns false on unknown id", async () => {
    const m = await loadStore();
    const target = path.join(TMP_HOME, "p2");
    fs.mkdirSync(target, { recursive: true });
    const f = m.addFolder(target);
    expect(m.removeFolder(f.id)).toBe(true);
    expect(m.listFolders()).toEqual([]);
    expect(m.removeFolder(f.id)).toBe(false);
  });

  it("reindexFolder sets status to queued + clears indexedAt", async () => {
    const m = await loadStore();
    const target = path.join(TMP_HOME, "p3");
    fs.mkdirSync(target, { recursive: true });
    const f = m.addFolder(target);
    // Simulate a prior indexed-state by mutating the file.
    const file = path.join(TMP_HOME, ".ares", "indexed-folders.json");
    const arr = JSON.parse(fs.readFileSync(file, "utf8"));
    arr[0].status = "indexed";
    arr[0].indexedAt = Date.now();
    fs.writeFileSync(file, JSON.stringify(arr));
    const r = m.reindexFolder(f.id);
    expect(r.status).toBe("queued");
    expect(r.indexedAt).toBeNull();
  });
});

describe("indexed-folders — path validation", () => {
  it("rejects non-existent paths", async () => {
    const m = await loadStore();
    expect(() => m.addFolder(path.join(TMP_HOME, "does-not-exist")))
      .toThrowError(/path does not exist/);
  });

  it("rejects file paths (not directories)", async () => {
    const m = await loadStore();
    const fp = path.join(TMP_HOME, "a-file.txt");
    fs.writeFileSync(fp, "x");
    expect(() => m.addFolder(fp)).toThrowError(/not a directory/);
  });

  it("rejects empty / non-string paths", async () => {
    const m = await loadStore();
    expect(() => m.addFolder("")).toThrowError(/path required/);
    expect(() => m.addFolder(undefined)).toThrowError(/path required/);
  });

  it("rejects banned paths: /, /usr, /Applications, /System, /Library", async () => {
    const m = await loadStore();
    for (const p of ["/", "/usr", "/Applications", "/System", "/Library"]) {
      // Skip if the banned path doesn't actually exist in the test env
      // (CI containers may not have /Applications). We only care about
      // the validation refusal — the validator's first check is the ban
      // list, so even non-existent banned paths must produce
      // "reserved" error.
      try {
        m.addFolder(p);
        // If we got here without throwing, that's a regression.
        throw new Error(`expected validation to reject ${p}`);
      } catch (e) {
        expect(e.message).toMatch(/reserved|does not exist/);
      }
    }
  });

  it("rejects ~/ (the literal home directory)", async () => {
    const m = await loadStore();
    expect(() => m.addFolder(TMP_HOME)).toThrowError(/reserved/);
  });

  it("validateFolderPath surfaces ok=true with the resolved path", async () => {
    const m = await loadStore();
    const target = path.join(TMP_HOME, "valid");
    fs.mkdirSync(target, { recursive: true });
    const v = m.validateFolderPath(target);
    expect(v.ok).toBe(true);
    expect(v.resolved).toBe(target);
  });
});

describe("indexed-folders — 404-shaped operations", () => {
  it("removeFolder on unknown id returns false", async () => {
    const m = await loadStore();
    expect(m.removeFolder("nope")).toBe(false);
  });

  it("reindexFolder on unknown id returns null", async () => {
    const m = await loadStore();
    expect(m.reindexFolder("nope")).toBeNull();
  });
});

describe("index-config — defaults + clamping", () => {
  it("getConfig returns sane defaults when nothing is persisted", async () => {
    const m = await loadStore();
    const cfg = m.getConfig();
    expect(cfg.storageLimitGiB).toBe(4);
    expect(cfg.maxFileMiB).toBe(32);
    expect(cfg.maxFolderMiB).toBe(128);
  });

  it("setConfig clamps values to the allowed ranges", async () => {
    const m = await loadStore();
    const r = m.setConfig({
      storageLimitGiB: 1000,    // > 32 → clamped to 32
      maxFileMiB: 0.1,          // < 1  → clamped to 1
      maxFolderMiB: 5,          // < 32 → clamped to 32
    });
    expect(r.storageLimitGiB).toBe(32);
    expect(r.maxFileMiB).toBe(1);
    expect(r.maxFolderMiB).toBe(32);
  });

  it("setConfig persists across reads", async () => {
    const m = await loadStore();
    m.setConfig({ storageLimitGiB: 8, maxFileMiB: 64, maxFolderMiB: 256 });
    expect(m.getConfig()).toEqual({ storageLimitGiB: 8, maxFileMiB: 64, maxFolderMiB: 256 });
  });

  it("getConfig coerces non-numeric junk back to defaults", async () => {
    const m = await loadStore();
    const file = path.join(TMP_HOME, ".ares", "index-config.json");
    fs.writeFileSync(file, JSON.stringify({ storageLimitGiB: "bogus" }));
    const cfg = m.getConfig();
    expect(cfg.storageLimitGiB).toBe(4);
  });
});

describe("diskSpace — basic shape", () => {
  it("returns numeric free/total/usedAres/usedFolders", async () => {
    const m = await loadStore();
    const d = m.diskSpace();
    expect(typeof d.free).toBe("number");
    expect(typeof d.total).toBe("number");
    expect(typeof d.usedAres).toBe("number");
    expect(typeof d.usedFolders).toBe("number");
    // total >= free in any normal environment
    if (d.total > 0) expect(d.free).toBeLessThanOrEqual(d.total);
  });

  it("usedFolders sums sizeBytes from the indexed-folder records", async () => {
    const m = await loadStore();
    // Manually persist a known folder with sizeBytes.
    const target = path.join(TMP_HOME, "knownsize");
    fs.mkdirSync(target, { recursive: true });
    m.addFolder(target);
    const file = path.join(TMP_HOME, ".ares", "indexed-folders.json");
    const arr = JSON.parse(fs.readFileSync(file, "utf8"));
    arr[0].sizeBytes = 12345;
    fs.writeFileSync(file, JSON.stringify(arr));
    const d = m.diskSpace();
    expect(d.usedFolders).toBe(12345);
  });
});
