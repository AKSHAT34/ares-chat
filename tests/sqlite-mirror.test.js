// Phase Q-pass-5 P1-5 — SQLite mirror unit tests.
//
// Covers:
//   - schema bootstraps cleanly on a fresh DB
//   - upsertConversation idempotent (re-run produces same row)
//   - searchConversations finds rows by title + content
//   - feed item upsert + dismiss round-trip
//   - memory entry upsert
//   - clean-shutdown lock semantics
//   - rebuild from JSONL re-imports the same rows

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the mirror at an isolated temp file so tests don't touch ~/.ares/mirror.db.
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ares-mirror-test-"));
const TEST_DB = path.join(TEST_DIR, "test-mirror.db");
process.env.ARES_MIRROR_FILE = TEST_DB;

// Now import — the module reads ARES_MIRROR_FILE at top level.
const mirror = await import("../lib/sqlite-mirror.js");
const rebuild = await import("../lib/sqlite-mirror-rebuild.js");

function fakeSession(id, title, msgs = []) {
  return {
    id,
    title,
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
    pinned: false,
    messages: msgs.map((text, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: [{ type: "text", text }],
    })),
  };
}

describe("sqlite-mirror", () => {
  beforeEach(() => {
    // Wipe state between tests.
    try { mirror.closeMirror(); } catch {}
    try { fs.unlinkSync(TEST_DB); } catch {}
    try { fs.unlinkSync(TEST_DB + "-wal"); } catch {}
    try { fs.unlinkSync(TEST_DB + "-shm"); } catch {}
    try { fs.unlinkSync(mirror._internals.LOCK_FILE); } catch {}
  });

  afterEach(() => {
    try { mirror.closeMirror(); } catch {}
  });

  it("bootstraps schema cleanly on first open", () => {
    mirror.openMirror();
    const stat = mirror.flushAndStat();
    expect(stat).toBeTruthy();
    expect(stat.schemaVersion).toBe(1);
    expect(stat.counts.conversations).toBe(0);
    expect(stat.counts.messages).toBe(0);
    expect(stat.counts.feed_items).toBe(0);
    expect(fs.existsSync(TEST_DB)).toBe(true);
  });

  it("upsertConversation is idempotent — second run does not duplicate", () => {
    mirror.openMirror();
    const s = fakeSession("aaa-bbb", "Test session", ["hi", "hello back"]);
    mirror.upsertConversation(s);
    mirror.flushAndStat();
    mirror.upsertConversation(s); // second time
    const stat = mirror.flushAndStat();
    expect(stat.counts.conversations).toBe(1);
    expect(stat.counts.messages).toBe(2);
  });

  it("searchConversations matches title and content", () => {
    mirror.openMirror();
    mirror.upsertConversation(fakeSession("s1", "Vendor KPI deep dive", ["analyze acme-corp"]));
    mirror.upsertConversation(fakeSession("s2", "Random chat", ["weather forecast"]));
    mirror.upsertConversation(fakeSession("s3", "Another", ["acme-corp targets are red"]));
    const titleHits = mirror.searchConversations("KPI");
    expect(titleHits.length).toBe(1);
    expect(titleHits[0].id).toBe("s1");
    const contentHits = mirror.searchConversations("acme-corp");
    expect(contentHits.length).toBe(2);
    const ids = contentHits.map((r) => r.id).sort();
    expect(ids).toEqual(["s1", "s3"]);
  });

  it("upsertFeedItem and listFeedItems round-trip with relevance + dismissal", () => {
    mirror.openMirror();
    mirror.upsertFeedItem({
      id: "f1", source: "outlook", title: "ProjectX report failed", body: "tools missing",
      importance: "Important", relevance: 0.85, relevanceReason: "active ProjectX project",
      ts: 1700000005000,
    });
    mirror.upsertFeedItem({
      id: "f2", source: "slack", title: "Bhavya DM", body: "got beta access?",
      relevance: 0.4, ts: 1700000006000,
    });
    const items = mirror.listFeedItems({ sinceMs: 0, limit: 10 });
    expect(items.length).toBe(2);
    // Sorted desc — f2 newest first.
    expect(items[0].id).toBe("f2");
    expect(items[1].id).toBe("f1");
    expect(items[1].relevance).toBeCloseTo(0.85, 2);

    // Dismiss f1.
    mirror.upsertFeedItem({ id: "f1", source: "outlook", dismissed: true, createdAt: 0 });
    // listFeedItems hides dismissed rows by design — verify f1 is no longer
    // surfaced and f2 remains.
    const after = mirror.listFeedItems({ sinceMs: 0, limit: 10 });
    const ids = after.map((r) => r.id).sort();
    expect(ids).not.toContain("f1");
    expect(ids).toContain("f2");
  });

  it("upsertMemoryEntry deduplicates by composite hash", () => {
    mirror.openMirror();
    const entry = {
      timestamp: "2026-04-25T06:54:19.529Z",
      kind: "fact",
      summary: "Pinned canonical AVS catalog",
      details: "Long detail text",
      outcome: "completed",
      tags: ["ares-critical", "data-query"],
    };
    mirror.upsertMemoryEntry(entry);
    mirror.upsertMemoryEntry(entry);
    const stat = mirror.flushAndStat();
    expect(stat.counts.memory).toBe(1);
  });

  it("kg upsert handles nodes and edges", () => {
    mirror.openMirror();
    mirror.upsertKgNode({ id: "user", type: "person", label: "User", summary: "the user" });
    mirror.upsertKgNode({ id: "saumya", type: "person", label: "Saumya Velury", summary: "manager" });
    mirror.upsertKgEdge({ from: "user", to: "saumya", relation: "reports_to", confidence: 0.99 });
    const stat = mirror.flushAndStat();
    expect(stat.counts.kg_nodes).toBe(2);
    expect(stat.counts.kg_edges).toBe(1);

    const hits = mirror.searchKnowledge("user");
    expect(hits.length).toBe(1);
    expect(hits[0].label).toBe("User");
  });

  it("deleteConversation cascades to messages", () => {
    mirror.openMirror();
    mirror.upsertConversation(fakeSession("delme", "to delete", ["a", "b", "c", "d"]));
    let stat = mirror.flushAndStat();
    expect(stat.counts.messages).toBe(4);
    mirror.deleteConversation("delme");
    stat = mirror.flushAndStat();
    expect(stat.counts.conversations).toBe(0);
    expect(stat.counts.messages).toBe(0);
  });

  it("markCleanShutdown removes the lock file", () => {
    mirror.openMirror();
    expect(fs.existsSync(mirror._internals.LOCK_FILE)).toBe(true);
    mirror.markCleanShutdown();
    expect(fs.existsSync(mirror._internals.LOCK_FILE)).toBe(false);
    const stat = mirror.flushAndStat();
    expect(stat.health.last_clean_shutdown).toBeGreaterThan(0);
  });

  it("rebuild from sessions JSONL re-imports rows", async () => {
    // Seed a small sessions dir on disk.
    const seedDir = fs.mkdtempSync(path.join(os.tmpdir(), "ares-mirror-rebuild-"));
    fs.writeFileSync(
      path.join(seedDir, "abc-def.json"),
      JSON.stringify(fakeSession("abc-def", "Rebuild target", ["one", "two"])),
    );
    fs.writeFileSync(
      path.join(seedDir, "xyz-pqr.json"),
      JSON.stringify(fakeSession("xyz-pqr", "Second one", ["three"])),
    );
    // Rebuild fresh.
    const result = await rebuild.rebuildFromJsonl({ sessionsDir: seedDir, log: () => {} });
    expect(result.summary.sessions.upserted).toBe(2);
    expect(result.stat.counts.conversations).toBe(2);
    expect(result.stat.counts.messages).toBe(3); // 2 + 1
  });
});
