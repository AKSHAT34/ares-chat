#!/usr/bin/env node
// Phase 1 — Static syntax check.
//
// Recursively `node --check` every .js/.mjs file under lib/, scripts/, jobs/,
// public/, plus server.js + main.js at the root. Skips node_modules, .bak,
// sessions/.
//
// Exit code 0 = all files parse cleanly.
// Exit code 1 = first file with a syntax error (path printed; full error to stderr).
//
// Wired by launch-with-check.sh as a pre-launchd gate so a syntax error in
// any module aborts the boot WITHOUT entering crash-loop.

import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOTS = ["server.js", "lib", "scripts", "public", "tests"];
const SKIP_NAMES = new Set(["node_modules", ".git", "sessions", "sessions-archive", "uploads", ".kiro"]);
const SKIP_SUFFIX = [".bak", ".bak.cjs", ".bak.mjs"];

function shouldSkip(name) {
  if (SKIP_NAMES.has(name)) return true;
  if (name.startsWith(".")) return true;
  for (const s of SKIP_SUFFIX) if (name.endsWith(s)) return true;
  // Files like agent.js.bak.20260520-221928
  if (/\.bak(\.\w+)*$/.test(name)) return true;
  return false;
}

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (shouldSkip(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) yield* walk(full);
    else if (st.isFile() && (name.endsWith(".js") || name.endsWith(".mjs") || name.endsWith(".cjs"))) {
      yield full;
    }
  }
}

const start = Date.now();
const failures = [];
let count = 0;
for (const r of ROOTS) {
  const target = path.join(ROOT, r);
  if (!existsSync(target)) continue;
  const st = statSync(target);
  const files = st.isDirectory() ? [...walk(target)] : [target];
  for (const f of files) {
    count++;
    const res = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    if (res.status !== 0) {
      failures.push({ file: f, stderr: res.stderr || "(no stderr)" });
      // Fail fast — first error printed in detail.
      console.error(`\x1b[31m✗ syntax error\x1b[0m in ${path.relative(ROOT, f)}`);
      console.error(res.stderr.trim());
      process.exit(1);
    }
  }
}
const ms = Date.now() - start;
console.log(`\x1b[32m✓ check\x1b[0m — ${count} files passed in ${ms}ms`);
process.exit(0);
