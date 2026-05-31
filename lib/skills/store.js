// Q-pass-3 work-stream E — skills store reader.
//
// Lightweight read/write over the same `~/.kiro/skills/learned/` recipe
// folder the skills MCP owns. We DON'T own the schema — the MCP at
// `<workspace>/skills/server.js` is the authority. This module is a
// pure-Node accessor so the Q UI can list/inspect skills without paying
// the MCP round-trip.
//
// File shape:
//   ---
//   title: <string>
//   keywords: <comma list>
//   created/last_run/run_count/success_count/failure_count: <…>
//   builtIn: <"true" | "false" | omitted>  (Q-pass-3 — opt-in flag)
//   tools: <comma list>                     (Q-pass-3 — optional tool tags)
//   ---
//   # <title>
//   ## Preconditions / Steps / Notes (markdown)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LEARNED_DIR = path.join(os.homedir(), ".kiro", "skills", "learned");
const BUILTIN_DIR = path.join(os.homedir(), ".kiro", "skills", "builtin");

function _ensureDir(d) { try { fs.mkdirSync(d, { recursive: true }); } catch {} }

function slugify(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function _parse(filepath) {
  const raw = fs.readFileSync(filepath, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const body = m ? m[2] : raw;
  const meta = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2];
    }
  }
  return { meta, body, raw };
}

function _summarize(body) {
  // First non-heading paragraph after the H1 title is the description.
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && (!lines[i].trim() || lines[i].startsWith("#"))) i++;
  const para = [];
  while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#")) {
    para.push(lines[i].trim());
    i++;
  }
  return para.join(" ").slice(0, 240);
}

function _readDir(dir, builtIn) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    try {
      const fp = path.join(dir, f);
      const { meta, body } = _parse(fp);
      const slug = f.replace(/\.md$/, "");
      const tools = (meta.tools || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
      const isBuiltIn = builtIn || meta.builtIn === "true";
      out.push({
        slug,
        title: meta.title || slug,
        description: _summarize(body),
        keywords: (meta.keywords || "").split(",").map((s) => s.trim()).filter(Boolean),
        tools,
        builtIn: isBuiltIn,
        runCount: Number(meta.run_count || 0),
        successCount: Number(meta.success_count || 0),
        failureCount: Number(meta.failure_count || 0),
        lastRun: meta.last_run || null,
        path: fp,
      });
    } catch {
      // Skip files that fail to parse — never throw for one bad recipe.
    }
  }
  return out;
}

export function listSkills() {
  _ensureDir(LEARNED_DIR);
  _ensureDir(BUILTIN_DIR);
  return [
    ..._readDir(BUILTIN_DIR, true),
    ..._readDir(LEARNED_DIR, false),
  ].sort((a, b) => a.title.localeCompare(b.title));
}

export function getSkill(slug) {
  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) return null;
  for (const dir of [BUILTIN_DIR, LEARNED_DIR]) {
    const fp = path.join(dir, `${slug}.md`);
    if (fs.existsSync(fp)) {
      const isBuiltIn = dir === BUILTIN_DIR;
      const { meta, body } = _parse(fp);
      return {
        slug,
        title: meta.title || slug,
        description: _summarize(body),
        keywords: (meta.keywords || "").split(",").map((s) => s.trim()).filter(Boolean),
        tools: (meta.tools || "").split(",").map((s) => s.trim()).filter(Boolean),
        builtIn: isBuiltIn || meta.builtIn === "true",
        runCount: Number(meta.run_count || 0),
        successCount: Number(meta.success_count || 0),
        failureCount: Number(meta.failure_count || 0),
        lastRun: meta.last_run || null,
        body,
        path: fp,
      };
    }
  }
  return null;
}

export function deleteSkill(slug) {
  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    const e = new Error("invalid slug");
    e.code = "INVALID_SLUG";
    throw e;
  }
  // Refuse to delete built-in skills — they ship with the product.
  const builtinFp = path.join(BUILTIN_DIR, `${slug}.md`);
  if (fs.existsSync(builtinFp)) {
    const e = new Error("cannot delete a built-in skill");
    e.code = "BUILTIN_PROTECTED";
    throw e;
  }
  const userFp = path.join(LEARNED_DIR, `${slug}.md`);
  if (!fs.existsSync(userFp)) return false;
  fs.unlinkSync(userFp);
  return true;
}

/**
 * Persist a freshly-uploaded or AI-drafted skill into ~/.kiro/skills/learned.
 * Re-uses the same frontmatter shape the skills MCP writes.
 */
export function saveUserSkill({ title, body, keywords = [], tools = [] }) {
  if (!title || typeof title !== "string") {
    const e = new Error("title required"); e.code = "INVALID_INPUT"; throw e;
  }
  if (!body || typeof body !== "string") {
    const e = new Error("body required"); e.code = "INVALID_INPUT"; throw e;
  }
  _ensureDir(LEARNED_DIR);
  const slug = slugify(title);
  if (!slug) {
    const e = new Error("title must contain at least one alphanumeric"); e.code = "INVALID_INPUT"; throw e;
  }
  const filepath = path.join(LEARNED_DIR, `${slug}.md`);
  const meta = {
    title,
    keywords: keywords.join(","),
    tools: tools.join(","),
    created: new Date().toISOString(),
    last_run: "",
    run_count: 0,
    success_count: 0,
    failure_count: 0,
  };
  // If body already starts with frontmatter, accept it verbatim.
  const trimmed = body.replace(/^﻿/, "");
  const md = trimmed.startsWith("---\n")
    ? trimmed
    : ["---",
       ...Object.entries(meta).map(([k, v]) => `${k}: ${v}`),
       "---",
       "",
       trimmed].join("\n");
  fs.writeFileSync(filepath, md);
  return { slug, path: filepath };
}

export const _internal = { LEARNED_DIR, BUILTIN_DIR, slugify };
