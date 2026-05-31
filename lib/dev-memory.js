// Dev-mode memory store — append-only JSONL at ~/.ares/dev-memory.jsonl.
// Separate from the work-mode journal so dev self-improvement context
// never pollutes the user's operational memory.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEV_MEMORY_DIR = path.join(os.homedir(), ".ares");
const DEV_MEMORY_PATH = path.join(DEV_MEMORY_DIR, "dev-memory.jsonl");

function _ensureDir() {
  fs.mkdirSync(DEV_MEMORY_DIR, { recursive: true });
}

/**
 * Append a dev-mode memory entry.
 * @param {{ summary: string, details?: string, files?: string[], outcome?: string, lessons?: string, tags?: string[] }} entry
 */
export function recordDev({ summary, details, files, outcome, lessons, tags }) {
  _ensureDir();
  const record = {
    id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    summary: summary || "",
    details: details || "",
    files: files || [],
    outcome: outcome || "completed",
    lessons: lessons || "",
    tags: tags || [],
  };
  fs.appendFileSync(DEV_MEMORY_PATH, JSON.stringify(record) + "\n");
  return record;
}

/**
 * Substring search over the dev memory journal.
 * @param {string} query
 * @param {number} [limit=10]
 * @returns {Array}
 */
export function searchDev(query, limit = 10) {
  if (!fs.existsSync(DEV_MEMORY_PATH)) return [];
  const raw = fs.readFileSync(DEV_MEMORY_PATH, "utf8");
  if (!raw.trim()) return [];
  const lines = raw.trim().split("\n");
  const q = (query || "").toLowerCase();
  const results = [];
  // Search newest-first so the most recent matches surface first.
  for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      const haystack = [
        entry.summary,
        entry.details,
        entry.lessons,
        ...(entry.tags || []),
        ...(entry.files || []),
      ].join(" ").toLowerCase();
      if (!q || haystack.includes(q)) {
        results.push(entry);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return results;
}

/**
 * List the N most recent dev memory entries.
 * @param {number} [limit=20]
 * @returns {Array}
 */
export function listDev(limit = 20) {
  if (!fs.existsSync(DEV_MEMORY_PATH)) return [];
  const raw = fs.readFileSync(DEV_MEMORY_PATH, "utf8");
  if (!raw.trim()) return [];
  const lines = raw.trim().split("\n");
  const results = [];
  for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
    try {
      results.push(JSON.parse(lines[i]));
    } catch {
      // Skip malformed lines
    }
  }
  return results;
}
