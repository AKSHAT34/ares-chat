// Phase-4 audit · D-12 · session-rag DB cache must be LRU-bounded.
//
// Pre-fix bug: _dbs was an unbounded Map. Every queried session left an
// open SQLite handle (db/wal/shm = 3 FDs) until process exit. macOS
// default ulimit 256 → FD exhaustion on a long-running server.
//
// Post-fix: cache caps at 32 (configurable via ARES_RAG_DB_CACHE_CAP),
// bumps to most-recent end on access, evicts oldest with db.close() on
// insert past the cap. closeAllRagDbs() drains everything on SIGTERM.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Override the cap to 4 so we can prove eviction with small input.
const PRIOR_CAP = process.env.ARES_RAG_DB_CACHE_CAP;
process.env.ARES_RAG_DB_CACHE_CAP = "4";

// Import AFTER setting env so the module-level cap reads our value.
const { indexTurn, _resetRagCacheForTests, _ragCacheStateForTests, closeAllRagDbs } =
  await import("../lib/session-rag.js");

let tmpDir;

beforeEach(() => {
  _resetRagCacheForTests();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-rag-lru-"));
});

afterEach(() => {
  _resetRagCacheForTests();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  if (PRIOR_CAP === undefined) delete process.env.ARES_RAG_DB_CACHE_CAP;
  else process.env.ARES_RAG_DB_CACHE_CAP = PRIOR_CAP;
});

async function indexOne(sid) {
  await indexTurn({
    sessionsDir: tmpDir,
    sessionId: sid,
    seq: 1,
    role: "user",
    content: "hello world",
  });
}

describe("Phase-4 D-12 · session-rag LRU cap", () => {
  it("evicts the oldest DB when the cap is exceeded", async () => {
    // Open 5 sessions; cap is 4, so the first one must evict.
    for (const sid of ["A", "B", "C", "D", "E"]) {
      await indexOne(sid);
    }
    const state = _ragCacheStateForTests();
    expect(state.size).toBe(4);
    expect(state.cap).toBe(4);
    expect(state.keys).not.toContain("A");
    expect(state.keys).toContain("E");
  });

  it("re-accessing a cached session bumps it to most-recent (so it survives)", async () => {
    for (const sid of ["A", "B", "C", "D"]) {
      await indexOne(sid);
    }
    // Re-touch A — it should move to the most-recent end.
    await indexOne("A");
    // Now insert E. The LRU eviction should drop B (which is now oldest).
    await indexOne("E");
    const state = _ragCacheStateForTests();
    expect(state.size).toBe(4);
    expect(state.keys).toContain("A");
    expect(state.keys).not.toContain("B");
    expect(state.keys).toContain("E");
  });

  it("closeAllRagDbs() drains the cache (used by SIGTERM)", async () => {
    for (const sid of ["A", "B", "C"]) {
      await indexOne(sid);
    }
    expect(_ragCacheStateForTests().size).toBe(3);
    closeAllRagDbs();
    expect(_ragCacheStateForTests().size).toBe(0);
  });
});
