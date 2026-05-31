// Phase Q13 — knowledge-graph scaffold (server side).
//
// The full builder (Haiku batches over the journal, edge-confidence
// scoring, SQLite name index) is a non-trivial offline pass. This file
// ships the minimal contract the Q UI relies on so the graph view
// renders even before the full builder runs:
//
//   - listNodes(typeFilter?)  → array of nodes from ~/.ares/knowledge-graph.jsonl
//   - getNode(id)             → single node + its first-degree edges
//   - rebuildEmpty()          → write an empty file so subsequent reads
//                               don't 404 (idempotent)
//
// The actual cold build (Q21 will tackle full migration) appends rich
// nodes + edges to the same JSONL. The UI degrades to "Browse all"
// table view when the graph is empty.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const KG_FILE = process.env.ARES_KG_FILE
  || path.join(os.homedir(), ".ares", "knowledge-graph.jsonl");

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(KG_FILE), { recursive: true }); } catch {}
}

function _readLines() {
  try {
    const raw = fs.readFileSync(KG_FILE, "utf8");
    return raw.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function rebuildEmpty() {
  _ensureDir();
  if (!fs.existsSync(KG_FILE)) fs.writeFileSync(KG_FILE, "");
  return { ok: true, file: KG_FILE };
}

export function listNodes({ type } = {}) {
  const out = [];
  for (const line of _readLines()) {
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (!j || j.kind !== "node") continue;
    if (type && j.type !== type) continue;
    out.push(j);
  }
  return out;
}

export function getNode(id) {
  let node = null;
  const edges = [];
  for (const line of _readLines()) {
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (!j) continue;
    if (j.kind === "node" && j.id === id) node = j;
    if (j.kind === "edge" && (j.from === id || j.to === id)) edges.push(j);
  }
  return { node, edges };
}

/**
 * Q-pass-5 close-out — return ALL edges from the KG file.
 * Used by the graph visualisation to render connections between nodes.
 */
export function listEdges() {
  const out = [];
  for (const line of _readLines()) {
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (!j || j.kind !== "edge") continue;
    out.push(j);
  }
  return out;
}

/** Stub — Q13 only ships the read API; full build comes via a script. */
export function getStats() {
  let nodes = 0, edges = 0;
  for (const line of _readLines()) {
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (!j) continue;
    if (j.kind === "node") nodes++;
    else if (j.kind === "edge") edges++;
  }
  return { nodes, edges, file: KG_FILE };
}

/**
 * Q-pass-3 — case-insensitive substring search over node labels.
 * Returns up to `limit` nodes ordered by:
 *   1) prefix match
 *   2) shortest label first
 *   3) original file order
 */
export function searchNodes(query, { limit = 12 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const matches = [];
  let idx = 0;
  for (const line of _readLines()) {
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (!j || j.kind !== "node") continue;
    const label = String(j.label || j.id || "").toLowerCase();
    const pos = label.indexOf(q);
    if (pos === -1) continue;
    matches.push({ node: j, pos, len: label.length, idx: idx++ });
  }
  matches.sort((a, b) => {
    if ((a.pos === 0) !== (b.pos === 0)) return a.pos === 0 ? -1 : 1;
    if (a.len !== b.len) return a.len - b.len;
    return a.idx - b.idx;
  });
  return matches.slice(0, limit).map((m) => m.node);
}

/**
 * Q-pass-3 — patch the meta blob for a single node in place.
 *
 * Strategy: rewrite the JSONL atomically to a sibling tmp file then
 * rename. We could append a new node line and let the last-write-wins
 * read path pick it up, but the existing reads return the FIRST match,
 * so an in-place rewrite is safer and keeps the file size stable.
 *
 * The provided patch is shallow-merged into existing meta; pass `null`
 * inside `patch` to clear individual keys.
 */
export function setNodeMeta(id, patch) {
  if (!id || !patch || typeof patch !== "object") return { ok: false, error: "invalid input" };
  _ensureDir();
  if (!fs.existsSync(KG_FILE)) return { ok: false, error: "graph file missing" };
  const lines = _readLines();
  let updated = false;
  let updatedNode = null;
  const nextLines = lines.map((line) => {
    let j;
    try { j = JSON.parse(line); } catch { return line; }
    if (j?.kind === "node" && j.id === id) {
      const meta = { ...(j.meta || {}), ...patch };
      // Strip null keys to keep meta tidy.
      for (const k of Object.keys(meta)) {
        if (meta[k] === null) delete meta[k];
      }
      const nextNode = { ...j, meta };
      updated = true;
      updatedNode = nextNode;
      return JSON.stringify(nextNode);
    }
    return line;
  });
  if (!updated) return { ok: false, error: "not found" };
  const tmp = KG_FILE + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmp, nextLines.join("\n") + (nextLines.length ? "\n" : ""));
  fs.renameSync(tmp, KG_FILE);
  return { ok: true, node: updatedNode };
}
