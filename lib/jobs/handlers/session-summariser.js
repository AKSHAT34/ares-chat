// session-summariser — promotes idle sessions into the cross-session
// memory journal.
//
// Logic: walk every session JSON. If a session was last updated > 24h ago
// AND has not yet been promoted (we track promotion in
// ~/.kiro/cache/session-summaries/promoted.json), distill its transcript
// with Haiku into a structured journal entry and append via memory_record.
//
// Idempotent: a session is promoted at most once unless its updatedAt
// changes (then it gets a fresh promotion overriding the old entry).
//
// We deliberately keep this OUTSIDE the auto-recorder threshold — the
// existing in-line auto-record only fires on individual qualifying turns,
// missing the session-level perspective. This job catches the long tail.

import fs from "node:fs";
import path from "node:path";
import { cachePath, ensureDir, readJson, writeJson } from "../cache.js";

const STATE_FILE = cachePath("session-summaries", "promoted.json");
const IDLE_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 8;             // bound Haiku spend per tick
const MIN_MESSAGES = 4;            // skip trivial sessions
const MAX_TRANSCRIPT_CHARS = 30000;

const SUMMARISE_SYSTEM = `You distill an Ares chat session into a structured journal entry.
Output STRICT JSON only:
{
  "summary": "<one-sentence headline>",
  "topics": ["topic1","topic2"],
  "decisions": ["decision1"],
  "files_touched": ["path/to/file"],
  "tools_used": ["tool_name"],
  "outcome": "completed" | "partial" | "blocked" | "exploratory",
  "lessons": ["takeaway1"],
  "tags": ["short","tags"]
}
Rules:
- Be terse and factual. No filler. Quote-light, fact-heavy.
- Decisions = things the user committed to or Ares applied.
- Files_touched = real paths that appeared in the transcript.
- Tools_used = MCP tool names (e.g. "wiki-mcp__SimAddComment").
- Tags = 3-7 short kebab-case labels for retrieval.
- If a session is purely chitchat / non-substantive, set outcome="exploratory" and keep arrays small.`;

export async function run(ctx) {
  const sessionsDir = path.join(process.env.ARES_WORKSPACE || process.cwd(), "sessions");
  const promoted = readJson(STATE_FILE, { sessions: {} });
  const stats = { scanned: 0, eligible: 0, promoted: 0, skipped: 0, errors: 0 };

  const now = Date.now();
  const candidates = [];
  for (const f of fs.readdirSync(sessionsDir)) {
    if (!f.endsWith(".json")) continue;
    stats.scanned++;
    const sid = f.replace(/\.json$/, "");
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), "utf8")); } catch { continue; }
    if (!data?.messages || data.messages.length < MIN_MESSAGES) continue;
    if (!data.updatedAt) continue;
    if (now - data.updatedAt < IDLE_MS) continue;          // still warm
    const seen = promoted.sessions[sid];
    if (seen && seen.updatedAt === data.updatedAt) continue; // already promoted at this version
    candidates.push({ sid, data });
  }
  // Newest-idle first so the journal grows roughly chronologically forward.
  candidates.sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));
  stats.eligible = candidates.length;

  const batch = candidates.slice(0, MAX_PER_RUN);
  const haiku = ctx.bedrockFactory("us.anthropic.claude-haiku-4-5-20251001-v1:0");

  for (const { sid, data } of batch) {
    try {
      const transcript = renderTranscript(data.messages).slice(0, MAX_TRANSCRIPT_CHARS);
      const title = data.title || "(untitled)";
      const userText = `Session ${sid}\nTitle: ${title}\nLast updated: ${new Date(data.updatedAt).toISOString()}\nMessages: ${data.messages.length}\n\nTRANSCRIPT:\n${transcript}`;
      const r = await haiku.invoke({
        system: SUMMARISE_SYSTEM,
        messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
        max_tokens: 1500,
      });
      const txt = r?.content?.find((c) => c.type === "text")?.text || "";
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) { stats.errors++; continue; }
      const parsed = JSON.parse(m[0]);

      const recordSummary = `[session ${sid.slice(0,8)}] ${parsed.summary || title}`.slice(0, 200);
      const detailsLines = [
        `Session ${sid}`,
        `Title: ${title}`,
        `Messages: ${data.messages.length}`,
        `Last updated: ${new Date(data.updatedAt).toISOString()}`,
        `Topics: ${(parsed.topics || []).join(", ") || "—"}`,
        `Decisions:\n${(parsed.decisions || []).map((d) => `  - ${d}`).join("\n") || "  (none)"}`,
        `Files touched:\n${(parsed.files_touched || []).map((f) => `  - ${f}`).join("\n") || "  (none)"}`,
        `Tools used: ${(parsed.tools_used || []).join(", ") || "—"}`,
        `Lessons:\n${(parsed.lessons || []).map((l) => `  - ${l}`).join("\n") || "  (none)"}`,
      ].join("\n");

      const tags = [
        "session-summary",
        "auto-promoted",
        `session:${sid}`,
        ...(parsed.tags || []).slice(0, 7),
      ];
      await ctx.hub.callTool("memory__memory_record", {
        summary: recordSummary,
        details: detailsLines,
        outcome: parsed.outcome || "completed",
        tags,
      });
      promoted.sessions[sid] = {
        updatedAt: data.updatedAt,
        promotedAt: Date.now(),
        outcome: parsed.outcome,
      };
      stats.promoted++;
      ctx.log("info", `promoted session ${sid.slice(0,8)} (${parsed.outcome})`);
    } catch (err) {
      stats.errors++;
      ctx.log("warn", `summarise ${sid.slice(0,8)} failed: ${err.message}`);
    }
  }
  ensureDir(path.dirname(STATE_FILE));
  writeJson(STATE_FILE, promoted);

  return {
    summary: `Scanned ${stats.scanned} sessions, ${stats.eligible} idle-eligible, promoted ${stats.promoted} this tick (${stats.errors} errors). ${Math.max(0, stats.eligible - stats.promoted)} remaining for next tick.`,
    stats,
  };
}

function renderTranscript(messages) {
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const role = m.role || "?";
    let text = "";
    if (typeof m.content === "string") {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      const parts = [];
      for (const b of m.content) {
        if (b?.type === "text" && typeof b.text === "string") parts.push(b.text);
        else if (b?.type === "tool_use") parts.push(`[tool ${b.name}] ${tryStringify(b.input).slice(0, 400)}`);
        else if (b?.type === "tool_result") parts.push(`[tool_result] ${flattenResult(b.content).slice(0, 600)}`);
      }
      text = parts.join("\n");
    }
    text = text.replace(/\s+/g, " ").trim().slice(0, 1500);
    if (text) out.push(`[${i}] ${role}: ${text}`);
  }
  return out.join("\n");
}

function flattenResult(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((x) => x?.text || "").join("\n");
  return "";
}

function tryStringify(o) { try { return JSON.stringify(o); } catch { return ""; } }
