// Q-pass-3 (D) — Activity-feed configuration + per-source instructions.
//
// Two files in ~/.ares/:
//   feed-config.json        — { sources, checkFrequencyMinutes }
//   feed-instructions.json  — { [sourceKey]: "free-form text" }
//
// Both are simple JSON read/write helpers. Atomic writes via tmp+rename
// so a partial write can't corrupt the file.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ARES_HOME = path.join(os.homedir(), ".ares");
const CONFIG_FILE = path.join(ARES_HOME, "feed-config.json");
const INSTRUCTIONS_FILE = path.join(ARES_HOME, "feed-instructions.json");

const DEFAULT_CONFIG = {
  sources: {
    "slack-dm-mentions": true,
    "outlook-email": true,
    "outlook-calendar": true,
    "teams": false,
    "gmail": false,
    "google-calendar": false,
  },
  checkFrequencyMinutes: 15,
};

const ALLOWED_FREQ = new Set([5, 10, 15, 30, 60]);
const KNOWN_SOURCES = new Set(Object.keys(DEFAULT_CONFIG.sources));

function _ensureDir() {
  try { fs.mkdirSync(ARES_HOME, { recursive: true }); } catch {}
}

function _atomicWrite(file, obj) {
  _ensureDir();
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const j = JSON.parse(raw);
    return _normalizeConfig(j);
  } catch {
    return { ...DEFAULT_CONFIG, sources: { ...DEFAULT_CONFIG.sources } };
  }
}

function _normalizeConfig(j) {
  const out = { ...DEFAULT_CONFIG, sources: { ...DEFAULT_CONFIG.sources } };
  if (j && typeof j === "object") {
    if (j.sources && typeof j.sources === "object") {
      for (const k of Object.keys(j.sources)) {
        if (KNOWN_SOURCES.has(k)) out.sources[k] = !!j.sources[k];
      }
    }
    if (typeof j.checkFrequencyMinutes === "number"
      && ALLOWED_FREQ.has(j.checkFrequencyMinutes)) {
      out.checkFrequencyMinutes = j.checkFrequencyMinutes;
    }
  }
  return out;
}

export function writeConfig(patch) {
  const current = readConfig();
  const merged = _normalizeConfig({ ...current, ...patch,
    sources: { ...current.sources, ...(patch && patch.sources ? patch.sources : {}) },
  });
  _atomicWrite(CONFIG_FILE, merged);
  return merged;
}

export function readInstructions() {
  try {
    const raw = fs.readFileSync(INSTRUCTIONS_FILE, "utf8");
    const j = JSON.parse(raw);
    if (j && typeof j === "object") {
      const out = {};
      for (const [k, v] of Object.entries(j)) {
        if (typeof v === "string") out[k] = v.slice(0, 4000);
      }
      return out;
    }
  } catch {}
  return {};
}

export function writeInstructions(patch) {
  const current = readInstructions();
  const next = { ...current };
  if (patch && typeof patch === "object") {
    for (const [k, v] of Object.entries(patch)) {
      if (typeof k !== "string" || k.length > 100) continue;
      if (v === null || v === undefined || v === "") {
        delete next[k];
      } else if (typeof v === "string") {
        next[k] = v.slice(0, 4000);
      }
    }
  }
  _atomicWrite(INSTRUCTIONS_FILE, next);
  return next;
}

export const CONFIG_PATH = CONFIG_FILE;
export const INSTRUCTIONS_PATH = INSTRUCTIONS_FILE;
export { DEFAULT_CONFIG, ALLOWED_FREQ };
