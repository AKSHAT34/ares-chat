// Phase U16 — per-platform tool filtering.
//
// Each frontend identifies itself with a platform id when it loads
// (browser / electron-full / electron-compact / cli / slack / outlook).
// The hub consults this module to filter the tool list before handing
// it to Claude — that way the gateway adapters never see browser-only
// tools (computer-use, ares-actions cursor-driving), and the compact
// panel doesn't get the full filesystem-agent surface.
//
// Configuration lives at ~/.ares/ares-config.json (or
// `<workspace>/.ares/ares-config.json`, workspace overrides global).
// First-run boot seeds a sensible default. Users edit the file freely;
// changes apply on the next agent turn (no restart needed — we re-read
// the file on every getClaudeTools(platform) call).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const KNOWN_PLATFORMS = ["browser", "electron-full", "electron-compact", "cli", "slack", "outlook"];

// Defaults are deliberately permissive for `browser` / `electron-full`
// (they're the workhorse interactive surfaces) and tighten for
// platforms where the user can't visually confirm side effects.
const DEFAULT_CONFIG = {
  platforms: {
    browser: {
      allow: ["*"], // everything goes
      deny: [],
    },
    "electron-full": {
      allow: ["*"],
      deny: [],
    },
    "electron-compact": {
      // Floating panel is small — drop pixel-driving + heavy on-demand
      // MCPs from the default tool list. The user can still activate
      // them manually via ares_activate_mcp.
      allow: ["*"],
      deny: ["computer-use__*", "kiro-browser-agent__*", "chrome-real__*"],
    },
    cli: {
      allow: ["*"],
      deny: ["computer-use__*", "kiro-browser-agent__*", "chrome-real__*"],
    },
    slack: {
      // Gateway adapter for inbound Slack mentions. Strictly read-write
      // restricted — never drives the desktop, never opens browsers,
      // never touches the filesystem outside ~/.kiro/cache, never sends
      // mail. Drafts are still produced by the gateway delivery path
      // outside the agent's tool scope.
      allow: [
        "memory__*", "skills__*",
        "data-query-mcp__*",
        "wiki-mcp__InternalSearch", "wiki-mcp__ReadInternalWebsites",
        "ares_list_mcps",
      ],
      deny: ["*"],
    },
    outlook: {
      // Same read-only posture as slack.
      allow: [
        "memory__*", "skills__*",
        "data-query-mcp__*",
        "email-mcp__email_search", "email-mcp__email_read", "email-mcp__email_inbox",
        "wiki-mcp__InternalSearch", "wiki-mcp__ReadInternalWebsites",
        "ares_list_mcps",
      ],
      deny: ["*"],
    },
  },
};

function configPaths(workspaceRoot) {
  const out = [path.join(os.homedir(), ".ares", "ares-config.json")];
  if (workspaceRoot) out.push(path.join(workspaceRoot, ".ares", "ares-config.json"));
  return out;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

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

/**
 * Load the active config (default + global ~/.ares/… + optional workspace
 * override merged in priority order). Re-read on every call so user edits
 * apply without a server bounce.
 */
export function loadPlatformConfig({ workspaceRoot } = {}) {
  let merged = DEFAULT_CONFIG;
  for (const p of configPaths(workspaceRoot)) {
    const j = readJson(p);
    if (j) merged = deepMerge(merged, j);
  }
  return merged;
}

/**
 * One-shot seeder — writes the default config to ~/.ares/ares-config.json
 * if it doesn't exist. Called from server boot. Idempotent.
 */
export function ensureSeededConfig({ log = console.log } = {}) {
  const aresDir = path.join(os.homedir(), ".ares");
  const p = path.join(aresDir, "ares-config.json");
  if (fs.existsSync(p)) return false;
  try {
    fs.mkdirSync(aresDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(p, JSON.stringify(DEFAULT_CONFIG, null, 2), { mode: 0o600 });
    log(`[platforms] seeded ${p}`);
    return true;
  } catch (e) {
    log(`[platforms] failed to seed ${p}: ${e.message}`);
    return false;
  }
}

/**
 * Wildcard match: pattern "*" matches everything, "foo__*" matches any
 * tool whose prefixed name starts with "foo__". Exact match also works
 * (no wildcard).
 */
function matches(name, pattern) {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return name === pattern;
  // Anchored regex: "foo__*" → /^foo__.*$/
  const re = new RegExp("^" + pattern.split("*").map(escapeRegex).join(".*") + "$");
  return re.test(name);
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/**
 * Filter a tool list according to the platform's allow/deny rules.
 * Deny is checked first (so it always overrides allow). If allow is
 * `["*"]` everything not in deny survives.
 */
export function filterToolsForPlatform(tools, platform, { workspaceRoot } = {}) {
  if (!platform) return tools;
  if (!KNOWN_PLATFORMS.includes(platform)) return tools;
  const cfg = loadPlatformConfig({ workspaceRoot });
  const rules = cfg.platforms?.[platform];
  if (!rules) return tools;
  const allow = Array.isArray(rules.allow) ? rules.allow : ["*"];
  const deny  = Array.isArray(rules.deny)  ? rules.deny  : [];
  return tools.filter((t) => {
    const name = t.name;
    for (const d of deny) if (matches(name, d)) {
      // Deny-everything sentinel — only allow when an explicit allow matches.
      if (d === "*") return allow.some((a) => matches(name, a));
      return false;
    }
    return allow.some((a) => matches(name, a));
  });
}

export const PLATFORM_IDS = [...KNOWN_PLATFORMS];

/** Test hook — bypass the cache (currently we don't cache; kept for parity). */
export function _resetForTests() { /* no-op */ }
