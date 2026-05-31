// Q-pass-3 (work-stream C) — artifact-index aggregator unit tests.
//
// Builds isolated tmp `sessions/` + `uploads/` trees and walks them
// through the indexer. Three cases:
//   1) empty fixture → []
//   2) populated fixture → user-upload + assistant-output records
//   3) cache invalidation re-reads after a save mutation

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { listArtifacts, indexSession, invalidate, _resetForTests } from "../lib/artifact-index.js";

let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ares-artifact-test-"));
  fs.mkdirSync(path.join(tmpRoot, "sessions"), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, "uploads"), { recursive: true });
  _resetForTests();
});

afterEach(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
});

function _writeSession(id, body) {
  fs.writeFileSync(
    path.join(tmpRoot, "sessions", `${id}.json`),
    JSON.stringify(body, null, 2),
  );
}

describe("Q-pass-3 · artifact-index", () => {
  it("returns [] for an empty sessions tree", () => {
    const out = listArtifacts({
      sessionsDir: path.join(tmpRoot, "sessions"),
      uploadsRoot: path.join(tmpRoot, "uploads"),
    });
    expect(out).toEqual([]);
  });

  it("collects user uploads and assistant fs_write outputs", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sessionDir = path.join(tmpRoot, "uploads", sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const uploadPath = path.join(sessionDir, "report.csv");
    fs.writeFileSync(uploadPath, "a,b,c\n1,2,3\n");

    // Assistant fs_write target — file exists outside the uploads dir.
    const assistantOut = path.join(tmpRoot, "scratch.md");
    fs.writeFileSync(assistantOut, "# hello\n");

    _writeSession(sessionId, {
      id: sessionId,
      title: "Test session",
      createdAt: 1700000000000,
      updatedAt: 1700000010000,
      messages: [
        {
          role: "user",
          createdAt: 1700000000000,
          content: [
            { type: "text", text: "<attachment name=\"report.csv\">…</attachment>" },
            { type: "text", text: "please read" },
          ],
          _attachments: [
            { name: "report.csv", sizeBytes: 12, path: uploadPath, kind: "text" },
          ],
        },
        {
          role: "assistant",
          createdAt: 1700000005000,
          content: [
            { type: "text", text: "writing it" },
            {
              type: "tool_use",
              id: "toolu_xyz",
              name: "filesystem-agent__fs_write",
              input: { path: assistantOut, content: "# hello" },
            },
          ],
        },
      ],
    });

    const items = listArtifacts({
      sessionsDir: path.join(tmpRoot, "sessions"),
      uploadsRoot: path.join(tmpRoot, "uploads"),
    });

    expect(items.length).toBe(2);

    const upload = items.find((it) => it.kind === "user-upload");
    expect(upload).toBeDefined();
    expect(upload.name).toBe("report.csv");
    expect(upload.format).toBe("csv");
    expect(upload.sessionId).toBe(sessionId);
    expect(upload.sessionTitle).toBe("Test session");
    expect(upload.sizeBytes).toBe(12);

    const out = items.find((it) => it.kind === "assistant-output");
    expect(out).toBeDefined();
    expect(out.name).toBe("scratch.md");
    expect(out.format).toBe("md");
    expect(out.sizeBytes).toBeGreaterThan(0);
    expect(out.path).toBeUndefined(); // listArtifacts strips disk path

    // Sorted desc by createdAt — assistant turn (5000) came after user (0).
    expect(items[0].createdAt).toBeGreaterThanOrEqual(items[1].createdAt);
  });

  it("dedupes between _attachments and on-disk uploads, picks up disk-only orphans", () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const sessionDir = path.join(tmpRoot, "uploads", sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, "in-msg.png"), "PNG-bytes");
    fs.writeFileSync(path.join(sessionDir, "orphan.txt"), "lost+found");

    _writeSession(sessionId, {
      id: sessionId,
      title: "Mixed",
      createdAt: 1,
      updatedAt: 2,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hi" }],
          _attachments: [
            { name: "in-msg.png", path: path.join(sessionDir, "in-msg.png"), sizeBytes: 9, kind: "image" },
          ],
        },
      ],
    });

    const items = indexSession({
      sessionsDir: path.join(tmpRoot, "sessions"),
      uploadsRoot: path.join(tmpRoot, "uploads"),
      sessionId,
    });

    const names = items.map((it) => it.name).sort();
    expect(names).toEqual(["in-msg.png", "orphan.txt"]);
    // Both are user-uploads and have non-empty session title.
    for (const it of items) {
      expect(it.kind).toBe("user-upload");
      expect(it.sessionTitle).toBe("Mixed");
    }
  });

  it("invalidate() forces a re-read after a session mutation", () => {
    const sessionId = "33333333-3333-4333-8333-333333333333";
    fs.mkdirSync(path.join(tmpRoot, "uploads", sessionId), { recursive: true });

    _writeSession(sessionId, {
      id: sessionId,
      title: "v1",
      messages: [],
    });

    // First call — no artifacts in the tree.
    let items = listArtifacts({
      sessionsDir: path.join(tmpRoot, "sessions"),
      uploadsRoot: path.join(tmpRoot, "uploads"),
    });
    expect(items).toEqual([]);

    // Add a file via the same path the server would (mutate session JSON
    // and drop a real upload), without bumping mtime in a controlled way.
    fs.writeFileSync(path.join(tmpRoot, "uploads", sessionId, "note.md"), "notes");

    // Without invalidate the cache *might* still hit if mtime is identical —
    // explicit invalidate is the contract our hook uses.
    invalidate(sessionId);

    items = listArtifacts({
      sessionsDir: path.join(tmpRoot, "sessions"),
      uploadsRoot: path.join(tmpRoot, "uploads"),
    });
    expect(items.length).toBe(1);
    expect(items[0].name).toBe("note.md");
  });
});
