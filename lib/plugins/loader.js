// Phase U14 — plugin loader.
//
// Scans two directories for ES-module plugins:
//   - ~/.ares/plugins/                         (user-global)
//   - <ARES_WORKSPACE>/.ares/plugins/           (workspace-scoped)
//
// Each plugin is a single .js or .mjs file (or a directory with index.js)
// exporting any subset of the hook functions:
//
//   preTurn({ messages, sessionId })          → optional
//   postTurn({ messages, sessionId, finalText }) → optional
//   preToolCall({ toolName, args, sessionId }) → optional
//                              return false to veto the call (fired
//                              like an approval deny — the agent sees
//                              an isError tool_result with the reason)
//   postToolCall({ toolName, args, result, durationMs, sessionId }) → optional
//   onError({ error, phase, sessionId })       → optional
//   onShutdown()                               → optional
//
// Plugins are loaded ONCE at boot. A loading failure is logged but
// non-fatal — a single broken plugin doesn't take the server down.
//
// We deliberately do NOT add a remote-fetch / auto-update mechanism;
// plugins are local files only.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const HOOK_NAMES = ["preTurn", "postTurn", "preToolCall", "postToolCall", "onError", "onShutdown"];

function pluginRoots(workspaceRoot) {
  const out = [path.join(os.homedir(), ".ares", "plugins")];
  if (workspaceRoot) out.push(path.join(workspaceRoot, ".ares", "plugins"));
  return out;
}

/**
 * Discover plugin module paths under the configured roots.
 * Each entry looks like { id, path, root }.
 */
function discoverPlugins({ workspaceRoot, log = console.log } = {}) {
  const out = [];
  for (const root of pluginRoots(workspaceRoot)) {
    if (!fs.existsSync(root)) continue;
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (ent.name.startsWith(".") || ent.name.startsWith("_")) continue;
      const full = path.join(root, ent.name);
      if (ent.isDirectory()) {
        const idx = path.join(full, "index.js");
        if (fs.existsSync(idx)) out.push({ id: ent.name, path: idx, root });
      } else if (ent.isFile() && /\.(?:js|mjs)$/.test(ent.name)) {
        out.push({ id: ent.name.replace(/\.(?:js|mjs)$/, ""), path: full, root });
      }
    }
  }
  return out;
}

export class PluginRegistry {
  constructor() {
    this.plugins = []; // [{id, path, hooks: {preTurn, ...}, errors[]}]
  }

  async load({ workspaceRoot, log = console.log } = {}) {
    const found = discoverPlugins({ workspaceRoot, log });
    for (const entry of found) {
      try {
        const mod = await import(pathToFileURL(entry.path).href);
        const hooks = {};
        for (const name of HOOK_NAMES) {
          if (typeof mod[name] === "function") hooks[name] = mod[name];
        }
        const meta = mod.metadata || {};
        this.plugins.push({
          id: entry.id,
          path: entry.path,
          root: entry.root,
          metadata: meta,
          hooks,
          errors: [],
        });
        log(`[plugins] loaded "${entry.id}" from ${entry.path} (hooks: ${Object.keys(hooks).join(",") || "none"})`);
      } catch (err) {
        log(`[plugins] FAILED to load "${entry.id}" from ${entry.path}: ${err.message}`);
      }
    }
    return this.plugins;
  }

  /**
   * Run a hook across every plugin that exports it. Errors in individual
   * plugins are caught and recorded — never propagate to the caller.
   *
   * For preToolCall: an explicit `false` return from any plugin vetoes
   * the tool call. The first vetoing plugin's id + reason is recorded
   * in the returned object.
   *
   * Returns { fired, vetoed?, vetoBy?, reason? } for `preToolCall`,
   * just `{ fired }` for everything else.
   */
  async fire(hookName, ctx) {
    if (!HOOK_NAMES.includes(hookName)) {
      throw new Error(`unknown hook: ${hookName}`);
    }
    let fired = 0;
    let vetoed = false;
    let vetoBy = null;
    let reason = null;
    // B-49: deep-clone ctx before passing to each plugin. Pre-fix the
    // ctx (which carries the tool args + sessionId) was passed by
    // reference, so a malicious plugin could mutate ctx.args between
    // gates — e.g. swap a Slack channel id. Use structuredClone where
    // available (Node 17+); fall back to JSON round-trip for fields
    // that are JSON-safe (the surface here is plain data only).
    function _clone(obj) {
      try {
        return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
      } catch {
        // Non-cloneable values (functions, etc.) — return as-is and
        // let the receiving plugin observe the freeze instead.
        return obj;
      }
    }
    for (const p of this.plugins) {
      const fn = p.hooks[hookName];
      if (!fn) continue;
      try {
        const out = await fn(_clone(ctx));
        fired += 1;
        if (hookName === "preToolCall" && out === false) {
          vetoed = true;
          vetoBy = p.id;
          reason = `vetoed by plugin "${p.id}"`;
          break;
        }
        if (hookName === "preToolCall" && out && typeof out === "object" && out.veto) {
          vetoed = true;
          vetoBy = p.id;
          reason = out.reason || `vetoed by plugin "${p.id}"`;
          break;
        }
      } catch (err) {
        p.errors.push({ ts: Date.now(), hook: hookName, message: err.message });
        // Log but continue.
      }
    }
    return hookName === "preToolCall" ? { fired, vetoed, vetoBy, reason } : { fired };
  }

  list() {
    return this.plugins.map(({ hooks, ...rest }) => ({
      ...rest,
      hookNames: Object.keys(hooks),
    }));
  }
}

let _registry = null;

export function getPluginRegistry() {
  if (!_registry) _registry = new PluginRegistry();
  return _registry;
}

/** Test-only — drop the singleton so a fresh load() can run. */
export function _resetForTests() {
  _registry = null;
}
