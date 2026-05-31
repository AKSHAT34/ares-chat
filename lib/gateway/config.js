// Phase U07c — gateway config persistence at ~/.ares/gateway.json.
//
// Schema (all fields optional, defaults applied at read time):
//   {
//     enabled: false,                 // master switch — nothing polls until true
//     platforms: {
//       slack:   { enabled: false, channels: [], pollMs: 60000 },
//       outlook: { enabled: false, folders:  [], pollMs: 90000 },
//     },
//     delivery: {
//       slack:   "draft",  // "draft" | "post" — only "draft" honoured today
//       outlook: "draft",  // "draft" | "send" — only "draft" honoured today
//     },
//     model: "us.anthropic.claude-sonnet-4-20250514",
//   }
//
// Channels and folders are STRING ALLOWLISTS. An empty array = no inbound
// processing for that platform, even when its `enabled` is true.
//
// No external SaaS leaks: SAFE_MODE drafts only, even if delivery is set
// to "post"/"send" today. Phase U07c ships infrastructure; the user
// flips `enabled: true` per platform after reviewing the allowlist.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ARES_DIR = path.join(os.homedir(), ".ares");
const CONFIG_PATH = path.join(ARES_DIR, "gateway.json");

const DEFAULT_CONFIG = {
  enabled: false,
  platforms: {
    slack:   { enabled: false, channels: [], pollMs: 60_000 },
    outlook: { enabled: false, folders:  [], pollMs: 90_000 },
  },
  delivery: {
    slack:   "draft",
    outlook: "draft",
  },
  model: "us.anthropic.claude-sonnet-4-20250514",
};

function deepMerge(base, override) {
  if (override == null || typeof override !== "object") return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function getConfigPath() { return CONFIG_PATH; }

export function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(patch = {}) {
  fs.mkdirSync(ARES_DIR, { recursive: true, mode: 0o700 });
  const merged = deepMerge(readConfig(), patch);
  // Defensive: never persist `enabled` flags as anything but boolean.
  if (typeof merged.enabled !== "boolean") merged.enabled = false;
  for (const p of Object.values(merged.platforms || {})) {
    if (p && typeof p.enabled !== "boolean") p.enabled = false;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

export function defaultConfig() { return { ...DEFAULT_CONFIG }; }
