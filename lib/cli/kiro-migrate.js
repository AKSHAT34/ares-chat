// Phase U19 — `ares kiro migrate`.
//
// Walks ~/.kiro/{steering,skills,memory/journal.md} and copies them into
// ~/.ares/ alongside the U12 SOUL/USER/MEMORY files. Idempotent. Flags:
//
//   --dry-run    print what would be copied; touch nothing.
//   --overwrite  replace existing ~/.ares files even if they're newer.
//   --verbose    chatty output.
//
// Mapping:
//   ~/.kiro/steering/*.md            → ~/.ares/steering/*.md
//   ~/.kiro/skills/learned/*.md      → ~/.ares/skills/learned/*.md
//   ~/.kiro/memory/journal.md        → ~/.ares/MEMORY.md (APPENDED if a
//                                                          MEMORY.md already
//                                                          exists, full copy
//                                                          if missing)
//   ~/.kiro/memory/preferences.json  → ~/.ares/preferences.json
//
// We DON'T touch SOUL.md / USER.md — those are user-curated by U12 and
// have no Kiro analogue.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Resolve at call time so test redirects (HOME / ARES_PERSONA_DIR) work
// even though the module loaded before they were set.
function kiroDir() { return path.join(os.homedir(), ".kiro"); }
function aresDir() { return process.env.ARES_PERSONA_DIR || path.join(os.homedir(), ".ares"); }

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function ensureDir(p) { fs.mkdirSync(p, { recursive: true, mode: 0o700 }); }

function copyFile({ src, dest, overwrite, dryRun, log }) {
  if (!exists(src)) return { action: "skip", reason: "src missing" };
  if (exists(dest) && !overwrite) {
    return { action: "skip", reason: "dest exists (pass --overwrite to replace)" };
  }
  if (dryRun) return { action: "would-copy" };
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  try { fs.chmodSync(dest, 0o600); } catch {}
  return { action: "copied" };
}

function copyTree({ srcDir, destDir, overwrite, dryRun, log }) {
  if (!exists(srcDir)) return { copied: 0, skipped: 0, total: 0 };
  let copied = 0, skipped = 0, total = 0;
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
    total += 1;
    const src = path.join(srcDir, ent.name);
    const dest = path.join(destDir, ent.name);
    const r = copyFile({ src, dest, overwrite, dryRun, log });
    if (r.action === "copied" || r.action === "would-copy") copied += 1;
    else skipped += 1;
    if (log) log(`  ${r.action.padEnd(10)} ${path.relative(os.homedir(), src)} → ${path.relative(os.homedir(), dest)}`);
  }
  return { copied, skipped, total };
}

function appendJournal({ journalPath, memoryPath, overwrite, dryRun, log }) {
  if (!exists(journalPath)) return { action: "skip", reason: "journal missing" };
  const contents = fs.readFileSync(journalPath, "utf8");
  if (!exists(memoryPath)) {
    if (dryRun) return { action: "would-create" };
    ensureDir(path.dirname(memoryPath));
    fs.writeFileSync(memoryPath, contents, { mode: 0o600 });
    return { action: "created" };
  }
  if (overwrite) {
    if (dryRun) return { action: "would-overwrite" };
    fs.writeFileSync(memoryPath, contents, { mode: 0o600 });
    return { action: "overwrote" };
  }
  // Append with a heading separator.
  const existing = fs.readFileSync(memoryPath, "utf8");
  const marker = `\n\n## Imported from ~/.kiro/memory/journal.md (${new Date().toISOString()})\n\n`;
  if (existing.includes("Imported from ~/.kiro/memory/journal.md")) {
    return { action: "skip", reason: "already imported (marker present)" };
  }
  if (dryRun) return { action: "would-append", chars: contents.length };
  fs.writeFileSync(memoryPath, existing + marker + contents, { mode: 0o600 });
  return { action: "appended", chars: contents.length };
}

export function runKiroMigrate({ dryRun = false, overwrite = false, verbose = false, log = console.log } = {}) {
  const out = { dryRun, overwrite, sections: {} };
  const KD = kiroDir();
  const AD = aresDir();
  if (!exists(KD)) {
    log(`No ~/.kiro found at ${KD} — nothing to migrate.`);
    out.sections.error = "no kiro dir";
    return out;
  }
  ensureDir(AD);
  log(`Migrating ${KD} → ${AD}${dryRun ? " (DRY RUN)" : ""}`);

  // Steering
  log("\nSteering:");
  out.sections.steering = copyTree({
    srcDir: path.join(KD, "steering"),
    destDir: path.join(AD, "steering"),
    overwrite, dryRun,
    log: verbose ? log : null,
  });
  log(`  → ${out.sections.steering.copied}/${out.sections.steering.total} copied${dryRun ? " (would)" : ""}`);

  // Skills
  log("\nSkills (learned):");
  out.sections.skills = copyTree({
    srcDir: path.join(KD, "skills", "learned"),
    destDir: path.join(AD, "skills", "learned"),
    overwrite, dryRun,
    log: verbose ? log : null,
  });
  log(`  → ${out.sections.skills.copied}/${out.sections.skills.total} copied${dryRun ? " (would)" : ""}`);

  // Memory journal
  log("\nMemory journal:");
  out.sections.journal = appendJournal({
    journalPath: path.join(KD, "memory", "journal.md"),
    memoryPath: path.join(AD, "MEMORY.md"),
    overwrite, dryRun, log,
  });
  log(`  → ${out.sections.journal.action}${out.sections.journal.reason ? ` (${out.sections.journal.reason})` : ""}`);

  // Preferences
  log("\nPreferences:");
  const prefSrc = path.join(KD, "memory", "preferences.json");
  const prefDest = path.join(AD, "preferences.json");
  out.sections.preferences = copyFile({
    src: prefSrc, dest: prefDest, overwrite, dryRun, log,
  });
  log(`  → ${out.sections.preferences.action}${out.sections.preferences.reason ? ` (${out.sections.preferences.reason})` : ""}`);

  log(`\n${dryRun ? "(dry run — no files touched)" : "Migration complete."}`);
  return out;
}

// CLI entry. Returns the exit code (0 success, 1 error).
export async function runKiroMigrateCli(opts = {}) {
  const result = runKiroMigrate({
    dryRun:   opts["dry-run"] === true || opts.dry === true,
    overwrite: opts.overwrite === true,
    verbose: opts.verbose === true || opts.v === true,
    log: console.log,
  });
  return result.sections.error ? 1 : 0;
}
