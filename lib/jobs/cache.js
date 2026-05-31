// File-system cache helper for jobs. Keeps everything under
// ~/.kiro/cache/ — local, throwaway, derived data. Memory tier B at
// ~/.kiro/memory/ is unaffected by this.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const CACHE_ROOT = path.join(os.homedir(), ".kiro", "cache");

export function cachePath(...parts) {
  return path.join(CACHE_ROOT, ...parts);
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

export function appendJsonl(file, obj) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(obj) + "\n");
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function ymdHm() {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}_${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
}
