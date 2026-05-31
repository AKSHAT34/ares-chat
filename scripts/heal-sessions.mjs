#!/usr/bin/env node
// Walk every sessions/*.json, run the same _sanitizeMessages Pass-1+Pass-2
// the agent uses at runtime, and save back any session whose transcript
// needed repair. Idempotent — runs cleanly on already-healthy sessions.
//
// Usage:
//   AWS_PROFILE=your-aws-profile node scripts/heal-sessions.mjs [--dry-run]
//
// Writes the repaired JSON in place (archives the original under
// sessions-archive/<id>-pre-heal-<ts>.json so a bad run can be restored).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SESS = path.join(ROOT, "sessions");
const ARCHIVE = path.join(ROOT, "sessions-archive");
fs.mkdirSync(ARCHIVE, { recursive: true });

const dryRun = process.argv.includes("--dry-run");

function sanitize(messages) {
  // Mirror of lib/agent.js#_sanitizeMessages — inlined so this script is
  // self-contained and doesn't import the full Agent class.
  const validToolUseIds = new Set();
  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type === "tool_use" && b.id) validToolUseIds.add(b.id);
    }
  }
  const pass1 = [];
  for (const m of messages) {
    if (m.role === "user" && Array.isArray(m.content)) {
      const hasTR = m.content.some((b) => b.type === "tool_result");
      if (hasTR) {
        const prev = pass1[pass1.length - 1];
        const adj = new Set();
        if (prev && prev.role === "assistant" && Array.isArray(prev.content)) {
          for (const b of prev.content) {
            if (b.type === "tool_use" && b.id) adj.add(b.id);
          }
        }
        const filtered = m.content.filter((b) => {
          if (b.type !== "tool_result") return true;
          return adj.has(b.tool_use_id) && validToolUseIds.has(b.tool_use_id);
        });
        if (filtered.length === 0) continue;
        pass1.push({ ...m, content: filtered });
      } else {
        pass1.push(m);
      }
    } else {
      pass1.push(m);
    }
  }
  const pass2 = [];
  for (let i = 0; i < pass1.length; i++) {
    const m = pass1[i];
    pass2.push(m);
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    const tuIds = m.content.filter((b) => b.type === "tool_use" && b.id).map((b) => b.id);
    if (!tuIds.length) continue;
    const next = pass1[i + 1];
    const isNextUserBlocks = next && next.role === "user" && Array.isArray(next.content);
    const existing = new Set(
      isNextUserBlocks
        ? next.content.filter((b) => b.type === "tool_result" && b.tool_use_id).map((b) => b.tool_use_id)
        : []
    );
    const missing = tuIds.filter((id) => !existing.has(id));
    if (!missing.length) continue;
    const stubs = missing.map((id) => ({
      type: "tool_result",
      tool_use_id: id,
      content: [{ type: "text", text: "(result missing — transcript heal)" }],
      is_error: true,
    }));
    if (isNextUserBlocks) {
      const replaced = { ...next, content: [...stubs, ...next.content] };
      pass2.push(replaced);
      i += 1;
    } else {
      pass2.push({ role: "user", content: stubs });
    }
  }
  return pass2;
}

let healed = 0, skipped = 0, broken = 0;
for (const f of fs.readdirSync(SESS)) {
  if (!f.endsWith(".json")) continue;
  const p = path.join(SESS, f);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`[skip] ${f}: parse error — ${e.message}`);
    broken++;
    continue;
  }
  const before = JSON.stringify(data.messages || []);
  const cleaned = sanitize(data.messages || []);
  const after = JSON.stringify(cleaned);
  if (before === after) {
    skipped++;
    continue;
  }
  const beforeCount = (data.messages || []).length;
  const afterCount = cleaned.length;
  console.log(`[heal] ${f.slice(0,12)}  ${beforeCount} → ${afterCount} msgs`);
  if (!dryRun) {
    const archivePath = path.join(ARCHIVE, `${f.replace(/\.json$/,"")}-pre-heal-${Date.now()}.json`);
    fs.copyFileSync(p, archivePath);
    data.messages = cleaned;
    data.updatedAt = Date.now();
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  }
  healed++;
}

console.log(`\n${healed} healed, ${skipped} already clean, ${broken} unparseable${dryRun ? " (DRY RUN — no changes written)" : ""}`);
