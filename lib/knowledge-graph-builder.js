// Q-pass-2 — knowledge graph BUILDER. Read API lives in
// lib/knowledge-graph.js; this module owns the WRITE side: cold build,
// per-turn extraction, 6h refresh.
//
// Storage: append-only JSONL at ~/.ares/knowledge-graph.jsonl. Each
// line is one of:
//   { kind: "node", id, type, label, meta?, ts }
//   { kind: "edge", from, to, label, confidence, ts }
//
// Extraction: Haiku batches over (a) memory journal entries (cold +
// 6h refresh), (b) recent assistant turns (per-turn hook). Output is
// strict JSON of nodes + edges. We dedupe by id before append.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const KG_FILE = process.env.ARES_KG_FILE
  || path.join(os.homedir(), ".ares", "knowledge-graph.jsonl");
export { KG_FILE };
const NODE_TYPES = new Set([
  "person", "event", "channel", "organization",
  "project", "product", "defined-term", "service",
  "creative-work", "action",
]);

// In-process index of seen ids so we don't re-append duplicates.
let _seenIds = new Set();
let _loaded = false;

function _ensureFile() {
  try { fs.mkdirSync(path.dirname(KG_FILE), { recursive: true }); } catch {}
  if (!fs.existsSync(KG_FILE)) {
    try { fs.writeFileSync(KG_FILE, ""); } catch {}
    return;
  }
  // If a prior writer left the file without a trailing newline, the
  // next appendFileSync would jam two JSON objects onto one line and
  // corrupt JSONL parsing. Patch the gap once at boot.
  try {
    const stat = fs.statSync(KG_FILE);
    if (stat.size === 0) return;
    const fd = fs.openSync(KG_FILE, "r+");
    try {
      const buf = Buffer.alloc(1);
      fs.readSync(fd, buf, 0, 1, stat.size - 1);
      if (buf[0] !== 0x0a) fs.appendFileSync(KG_FILE, "\n");
    } finally { fs.closeSync(fd); }
  } catch {}
}

function _loadSeen() {
  if (_loaded) return;
  _ensureFile();
  try {
    const raw = fs.readFileSync(KG_FILE, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j?.kind === "node" && j.id) _seenIds.add(`node:${j.id}`);
        else if (j?.kind === "edge" && j.from && j.to) {
          _seenIds.add(`edge:${j.from}|${j.to}|${j.label || ""}`);
        }
      } catch {}
    }
  } catch {}
  _loaded = true;
}

function _slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// ── Levenshtein distance (inline, no deps) ─────────────────────────

function _levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Fuzzy-match a new label against existing nodes of the same type.
 * Returns the existing node id if Levenshtein distance ≤ 2 OR
 * case-insensitive exact match; otherwise returns null.
 */
function _findFuzzyDuplicate(type, label) {
  if (!label) return null;
  const lower = label.toLowerCase();
  try {
    const raw = fs.readFileSync(KG_FILE, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j?.kind !== "node" || j.type !== type) continue;
        const existing = String(j.label || "");
        // Case-insensitive exact match
        if (existing.toLowerCase() === lower) return j.id;
        // Levenshtein ≤ 2 (only compare if lengths are close to avoid
        // expensive computation on wildly different strings)
        if (Math.abs(existing.length - label.length) <= 2) {
          if (_levenshtein(existing.toLowerCase(), lower) <= 2) return j.id;
        }
      } catch {}
    }
  } catch {}
  return null;
}

/** Append one node — dedup by id (seen) + fuzzy label match. */
export function appendNode({ id, type, label, meta }) {
  _loadSeen();
  if (!id || !type || !NODE_TYPES.has(type)) return false;
  // Fuzzy dedup: if a node with a very similar label of the same type
  // already exists, reuse its id instead of creating a duplicate.
  const existingId = _findFuzzyDuplicate(type, label);
  if (existingId) {
    // Mark the canonical id as seen so future calls also skip.
    _seenIds.add(`node:${existingId}`);
    return false; // not a new node
  }
  const key = `node:${id}`;
  if (_seenIds.has(key)) return false;
  _seenIds.add(key);
  const line = JSON.stringify({ kind: "node", id, type, label: label ?? id, meta: meta ?? null, ts: Date.now() }) + "\n";
  try { fs.appendFileSync(KG_FILE, line); return true; } catch { return false; }
}

/**
 * Merge two nodes: rewrite all edges referencing sourceId to targetId,
 * then delete the source node from the JSONL. Returns { ok, edgesRewritten }.
 */
export function mergeNodes(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return { ok: false, error: "invalid ids" };
  _ensureFile();
  if (!fs.existsSync(KG_FILE)) return { ok: false, error: "graph file missing" };
  const lines = fs.readFileSync(KG_FILE, "utf8").split("\n");
  let edgesRewritten = 0;
  const nextLines = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { nextLines.push(line); continue; }
    // Remove the source node
    if (j?.kind === "node" && j.id === sourceId) {
      _seenIds.delete(`node:${sourceId}`);
      continue; // skip this line
    }
    // Rewrite edges
    if (j?.kind === "edge") {
      let changed = false;
      if (j.from === sourceId) { j.from = targetId; changed = true; }
      if (j.to === sourceId) { j.to = targetId; changed = true; }
      if (changed) edgesRewritten++;
      nextLines.push(JSON.stringify(j));
    } else {
      nextLines.push(line);
    }
  }
  const tmp = KG_FILE + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmp, nextLines.join("\n") + (nextLines.length ? "\n" : ""));
  fs.renameSync(tmp, KG_FILE);
  return { ok: true, edgesRewritten };
}

/**
 * Delete a node + all its edges from the JSONL.
 * Returns { ok, edgesRemoved }.
 */
export function deleteNode(nodeId) {
  if (!nodeId) return { ok: false, error: "missing id" };
  _ensureFile();
  if (!fs.existsSync(KG_FILE)) return { ok: false, error: "graph file missing" };
  const lines = fs.readFileSync(KG_FILE, "utf8").split("\n");
  let edgesRemoved = 0;
  let nodeFound = false;
  const nextLines = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { nextLines.push(line); continue; }
    if (j?.kind === "node" && j.id === nodeId) {
      nodeFound = true;
      _seenIds.delete(`node:${nodeId}`);
      continue;
    }
    if (j?.kind === "edge" && (j.from === nodeId || j.to === nodeId)) {
      edgesRemoved++;
      _seenIds.delete(`edge:${j.from}|${j.to}|${j.label || ""}`);
      continue;
    }
    nextLines.push(line);
  }
  if (!nodeFound) return { ok: false, error: "not found" };
  const tmp = KG_FILE + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmp, nextLines.join("\n") + (nextLines.length ? "\n" : ""));
  fs.renameSync(tmp, KG_FILE);
  return { ok: true, edgesRemoved };
}

/**
 * Delete a specific edge from the JSONL by (from, to, label).
 */
export function deleteEdge(from, to, label) {
  if (!from || !to) return { ok: false, error: "missing from/to" };
  _ensureFile();
  if (!fs.existsSync(KG_FILE)) return { ok: false, error: "graph file missing" };
  const lines = fs.readFileSync(KG_FILE, "utf8").split("\n");
  let found = false;
  const nextLines = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { nextLines.push(line); continue; }
    if (j?.kind === "edge" && j.from === from && j.to === to && (j.label || "") === (label || "")) {
      found = true;
      _seenIds.delete(`edge:${from}|${to}|${label || ""}`);
      continue;
    }
    nextLines.push(line);
  }
  if (!found) return { ok: false, error: "not found" };
  const tmp = KG_FILE + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmp, nextLines.join("\n") + (nextLines.length ? "\n" : ""));
  fs.renameSync(tmp, KG_FILE);
  return { ok: true };
}

/**
 * Update a node's label and/or meta in place.
 */
export function updateNode(nodeId, { label, meta }) {
  if (!nodeId) return { ok: false, error: "missing id" };
  _ensureFile();
  if (!fs.existsSync(KG_FILE)) return { ok: false, error: "graph file missing" };
  const lines = fs.readFileSync(KG_FILE, "utf8").split("\n");
  let updated = false;
  let updatedNode = null;
  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    let j;
    try { j = JSON.parse(line); } catch { return line; }
    if (j?.kind === "node" && j.id === nodeId) {
      if (label !== undefined) j.label = label;
      if (meta !== undefined) j.meta = { ...(j.meta || {}), ...meta };
      updated = true;
      updatedNode = j;
      return JSON.stringify(j);
    }
    return line;
  });
  if (!updated) return { ok: false, error: "not found" };
  const tmp = KG_FILE + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmp, nextLines.filter(l => l.trim()).join("\n") + "\n");
  fs.renameSync(tmp, KG_FILE);
  return { ok: true, node: updatedNode };
}

/** Append one edge — dedup by (from, to, label). */
export function appendEdge({ from, to, label, confidence }) {
  _loadSeen();
  if (!from || !to) return false;
  const key = `edge:${from}|${to}|${label || ""}`;
  if (_seenIds.has(key)) return false;
  _seenIds.add(key);
  const line = JSON.stringify({
    kind: "edge", from, to, label: label || "related",
    confidence: typeof confidence === "number" ? confidence : 0.7,
    ts: Date.now(),
  }) + "\n";
  try { fs.appendFileSync(KG_FILE, line); return true; } catch { return false; }
}

/** Stable id for a label+type pair. */
export function idFor(type, label) {
  return `${type}:${_slugify(label)}`;
}

/**
 * Extract entities from a single text blob via Haiku. Returns
 * { nodes: [{type,label}], edges: [{from,to,label}] } where ids are
 * derived from labels via idFor() so re-extracting the same text
 * doesn't grow the graph.
 *
 * Hard-budgeted: max_tokens=600 per call, ≈$0.0005/turn. The caller
 * (per-turn hook, cold-build loop, 6h refresh) decides how often.
 */
export async function extractEntities({ haiku, text, hint }) {
  const prompt = [
    "Extract entities + relationships from the following text.",
    "Output STRICT JSON, no prose:",
    '{"nodes": [{"type": "person|event|channel|organization|project|product|defined-term|service|creative-work|action", "label": "<short>", "meta": {}}], ' +
    '"edges": [{"from_label": "<label>", "to_label": "<label>", "label": "<specific-verb>", "confidence": 0.5-1.0}]}',
    "",
    "Rules:",
    "- Skip generic terms (the user, the agent, today, you).",
    "- Use canonical names where possible (e.g. 'Anastasia COUROUVE', not 'Anastasia').",
    "- Edge labels MUST be SPECIFIC verbs/relations — NOT generic 'operates', 'related-to'. Use: 'manages', 'reports-to', 'escalated-to', 'ships-from', 'deadline-for', 'attends', 'works-on', 'owns', 'reviews', 'blocks', 'depends-on', 'member-of', 'contracted-by'.",
    "- confidence: 1.0 = explicitly stated, 0.7 = strongly implied, 0.5 = weakly implied.",
    "- Extract temporal events (meetings, deadlines, QBRs, reviews) as type 'event' with a 'date' field in meta (ISO format if available, else natural language).",
    "- Extract vendor/product codes as type 'product' linked to their parent organization via 'manufactured-by' or 'sold-by' edge.",
    "- Return at most 12 nodes + 12 edges per call.",
    hint ? `- ${hint}` : "",
    "",
    "Text:",
    "<<<",
    String(text || "").slice(0, 6000),
    ">>>",
  ].filter(Boolean).join("\n");
  try {
    const r = await haiku.invoke({
      system: "You are an entity extractor. Output ONLY valid JSON.",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      max_tokens: 600,
    });
    const txt = r?.content?.find?.((c) => c.type === "text")?.text || "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { nodes: [], edges: [] };
    const j = JSON.parse(m[0]);
    return {
      nodes: Array.isArray(j.nodes) ? j.nodes : [],
      edges: Array.isArray(j.edges) ? j.edges : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

/** Ingest extracted entities into the JSONL store. */
export function ingestExtracted({ nodes, edges }) {
  let nodesAdded = 0, edgesAdded = 0;
  // Build a label→id map first so edges can resolve.
  const idByLabel = new Map();
  for (const n of nodes) {
    if (!n?.type || !n?.label || !NODE_TYPES.has(n.type)) continue;
    const id = idFor(n.type, n.label);
    idByLabel.set(n.label, id);
    if (appendNode({ id, type: n.type, label: n.label, meta: n.meta ?? null })) nodesAdded++;
  }
  for (const e of edges) {
    const from = idByLabel.get(e.from_label) || (e.from || null);
    const to = idByLabel.get(e.to_label) || (e.to || null);
    if (!from || !to) continue;
    if (appendEdge({ from, to, label: e.label, confidence: e.confidence })) edgesAdded++;
  }
  return { nodesAdded, edgesAdded };
}

// ── per-turn hook ───────────────────────────────────────────────────

/**
 * Fire-and-forget extractor. agent.js calls this on every postTurn
 * hook with the assistant's final text + the user's prompt. Errors
 * are swallowed; the agent never blocks on graph extraction.
 */
export function runPerTurnExtract({ haikuFactory, userText, assistantText, sessionId }) {
  if (!haikuFactory) return;
  const text = `User: ${userText || ""}\n\nAssistant: ${assistantText || ""}`;
  // Detach via setImmediate so the agent loop doesn't pay this cost.
  setImmediate(async () => {
    try {
      const haiku = haikuFactory();
      const ext = await extractEntities({ haiku, text, hint: `Session ${sessionId}` });
      if (ext.nodes.length || ext.edges.length) {
        ingestExtracted(ext);
      }
    } catch {}
  });
}

// ── 6h Slack/Outlook refresh ────────────────────────────────────────

let _refreshTimer = null;

async function _runRefresh({ hub, haikuFactory, log }) {
  if (!hub || !haikuFactory) return;
  const haiku = haikuFactory();
  let total = 0;
  // Pull a batch of fresh Slack mentions + Outlook unread metadata,
  // extract people/channels/orgs.
  try {
    const r = await hub.callTool("chat-mcp__get_unreads", { channels: [] });
    const text = (r?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("\n");
    if (text.length > 100) {
      const ext = await extractEntities({ haiku, text, hint: "Slack mentions" });
      const c = ingestExtracted(ext);
      total += c.nodesAdded + c.edgesAdded;
    }
  } catch {}
  try {
    const r = await hub.callTool("email-mcp__email_inbox", { folder: "Inbox", unread: true, limit: 50 });
    const text = (r?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("\n");
    if (text.length > 100) {
      const ext = await extractEntities({ haiku, text, hint: "Outlook unread" });
      const c = ingestExtracted(ext);
      total += c.nodesAdded + c.edgesAdded;
    }
  } catch {}
  if (log) log(`[kg] 6h refresh added ${total} entries`);
}

export function startGraphRefresh({ hub, haikuFactory, log = console.log }) {
  if (_refreshTimer) return;
  setTimeout(() => _runRefresh({ hub, haikuFactory, log }), 5 * 60_000); // first run 5 min after boot
  _refreshTimer = setInterval(() => _runRefresh({ hub, haikuFactory, log }), 6 * 3600_000);
  log("[kg] refresh scheduled (every 6h)");
}

export function stopGraphRefresh() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}

// ── retrieval helpers (used by agent.js pre-turn) ──────────────────

/**
 * Find graph entities mentioned in a freshly-arrived user prompt.
 * Returns array of { id, type, label } that we can inject as
 * extra context. Cheap — string match against the in-memory index.
 */
export function entitiesInText(text) {
  _loadSeen();
  const out = [];
  if (!text) return out;
  const lower = String(text).toLowerCase();
  // Re-scan the file (rare hot path; cheap because the JSONL is small
  // and we only care about node lines).
  try {
    const raw = fs.readFileSync(KG_FILE, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j?.kind !== "node") continue;
        const lbl = String(j.label || "").toLowerCase();
        if (lbl.length < 4) continue; // avoid common short tokens
        if (lower.includes(lbl)) {
          out.push({ id: j.id, type: j.type, label: j.label });
          if (out.length >= 12) break;
        }
      } catch {}
    }
  } catch {}
  return out;
}

/**
 * For each entity, return a short "neighbours" summary from the graph
 * — first-degree edges, capped at K. Used to build the pre-turn
 * context block.
 */
export function neighboursOf(id, { limit = 8 } = {}) {
  const out = [];
  try {
    const raw = fs.readFileSync(KG_FILE, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j?.kind !== "edge") continue;
        if (j.from === id) out.push({ direction: "out", to: j.to, label: j.label });
        else if (j.to === id) out.push({ direction: "in", from: j.from, label: j.label });
      } catch {}
      if (out.length >= limit) break;
    }
  } catch {}
  return out;
}
