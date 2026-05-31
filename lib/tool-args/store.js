// Phase RP1-B3 — persistent learning store for arg-shape fixes.
//
// File: ~/.kiro/cache/tool-arg-fixes.jsonl
//
// JSONL line shape:
//   {toolName, errorRegex, transform, promoted, applications, successes, addedAt, lastSuccessAt, expiresAt?}
//
// Lifecycle:
//   1. Hand-edited entries OR seed fixes start with `promoted: true` —
//      they apply immediately.
//   2. Runtime-learned candidates start unpromoted; bump
//      `applications` on every dispatch and `successes` on every
//      isError=false result. Promote at successes >= 3.
//   3. Hub re-reads the file every N tool calls (default 50) so a
//      hand-edit lands without restart.
//   4. Entries expire 30 days after last success — calls that no
//      longer recur are silently retired.

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseTransform, applyTransform } from "./transforms.js";
import { SEED_FIXES } from "./seed.js";

const PROMOTION_THRESHOLD = 3;
const EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;
const RELOAD_EVERY_N_CALLS = 50;

function defaultStorePath() {
  return path.join(os.homedir(), ".kiro", "cache", "tool-arg-fixes.jsonl");
}

export class ToolArgStore {
  constructor({ filePath = null } = {}) {
    this.filePath = filePath || defaultStorePath();
    this.entries = [];
    this.callsSinceLastReload = 0;
    this._loaded = false;
  }

  /**
   * Load the store from disk. Seeds the file with SEED_FIXES on
   * first ever load (when the file doesn't exist yet) so a fresh
   * install gets the canonical fixes.
   */
  load() {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (!existsSync(this.filePath)) {
      const seed = SEED_FIXES.map((f) => ({ ...f, addedAt: Date.now(), lastSuccessAt: 0 }));
      writeFileSync(this.filePath, seed.map((e) => JSON.stringify(e)).join("\n") + "\n");
    }

    const raw = readFileSync(this.filePath, "utf8");
    this.entries = raw.split("\n")
      .filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    // Drop expired entries.
    const now = Date.now();
    this.entries = this.entries.filter((e) => {
      if (!e.lastSuccessAt) return true; // never fired yet — keep
      return now - e.lastSuccessAt < EXPIRATION_MS;
    });

    this._loaded = true;
    this.callsSinceLastReload = 0;
  }

  /**
   * Look up applicable transforms for a tool. Only returns PROMOTED
   * entries — runtime candidates don't shape live calls until they
   * cross the success threshold.
   */
  fixesFor(toolName) {
    if (!this._loaded) this.load();
    return this.entries.filter((e) => e.promoted && e.toolName === toolName);
  }

  /**
   * Record a candidate fix when a tool returns isError. Caller passes
   * the matched seed entry (or a freshly-built one when no seed
   * matches). Idempotent.
   */
  recordCandidate({ toolName, errorRegex, transform }) {
    if (!this._loaded) this.load();
    const existing = this.entries.find((e) =>
      e.toolName === toolName && e.errorRegex === errorRegex && e.transform === transform);
    if (existing) return existing;
    const entry = {
      toolName, errorRegex, transform,
      promoted: false, applications: 0, successes: 0,
      addedAt: Date.now(), lastSuccessAt: 0,
    };
    this.entries.push(entry);
    appendFileSync(this.filePath, JSON.stringify(entry) + "\n");
    return entry;
  }

  /**
   * Increment success counters and promote at threshold. Returns the
   * updated entry or null if not found.
   */
  recordSuccess({ toolName, transform }) {
    if (!this._loaded) this.load();
    const entry = this.entries.find((e) => e.toolName === toolName && e.transform === transform);
    if (!entry) return null;
    entry.applications += 1;
    entry.successes += 1;
    entry.lastSuccessAt = Date.now();
    if (!entry.promoted && entry.successes >= PROMOTION_THRESHOLD) {
      entry.promoted = true;
    }
    this._rewriteAll();
    return entry;
  }

  recordApplication({ toolName, transform }) {
    if (!this._loaded) this.load();
    const entry = this.entries.find((e) => e.toolName === toolName && e.transform === transform);
    if (!entry) return null;
    entry.applications += 1;
    this._rewriteAll();
    return entry;
  }

  /** Mark this many calls have happened; reload when threshold hit. */
  noteCall() {
    this.callsSinceLastReload += 1;
    if (this.callsSinceLastReload >= RELOAD_EVERY_N_CALLS) {
      this.load();
    }
  }

  _rewriteAll() {
    writeFileSync(this.filePath, this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }
}

/**
 * Apply every applicable PROMOTED fix to args (in declaration order).
 * Returns `{args, applied: [{toolName, transform, reason}]}`. Does
 * not mutate the input.
 */
export function applyFixesFromStore(store, toolName, args) {
  const fixes = store.fixesFor(toolName);
  let cur = args;
  const applied = [];
  for (const f of fixes) {
    let parsed;
    try { parsed = parseTransform(f.transform); } catch { continue; }
    const r = applyTransform(cur, parsed);
    if (r.applied) {
      cur = r.args;
      applied.push({ toolName: f.toolName, transform: f.transform, reason: r.reason });
      store.recordApplication({ toolName: f.toolName, transform: f.transform });
    }
  }
  return { args: cur, applied };
}

// Process-wide singleton — the hub uses it directly. Tests construct
// their own ToolArgStore with a tmp file.
let _singleton = null;
export function getToolArgStore() {
  if (_singleton) return _singleton;
  _singleton = new ToolArgStore({});
  return _singleton;
}

export function _resetForTests() { _singleton = null; }
