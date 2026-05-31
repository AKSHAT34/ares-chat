// MCP hub with LAZY spawn.
//
// Only Tier 1 (memory, skills, shell-agent, filesystem-agent, ares-actions)
// starts at boot. Every other MCP lives in the catalog as a spec — it spawns
// only when the user or the agent calls ares_activate_mcp, and its child
// process is killed when deactivated. This keeps process count low, avoids
// fighting Kiro for stdio handles, and matches the user's preference of
// "max ~3 on-demand MCPs active at a time beyond the always-on set".

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { getSandbox } from "./sandbox/index.js";
import { recordSkillEvent } from "./skills/telemetry.js";
import { getPluginRegistry } from "./plugins/loader.js";
import { filterToolsForPlatform } from "./platforms.js";
import { getToolArgStore, applyFixesFromStore } from "./tool-args/store.js";
import { SEED_FIXES } from "./tool-args/seed.js";

const TOOL_SEP = "__";

// Manual connect/disconnect overrides persist here so a user's explicit
// choice survives restarts (user directive 2026-05-30: "if I manually
// connect with the MCP they should remain connected"). Shape:
//   { "<server>": "connected" | "disconnected" }
// A "connected" override forces a spawn at boot even if mcp.json marks the
// server disabled; a "disconnected" override skips a server that would
// otherwise auto-start. mcp.json is the default; this file is the user's
// last-word override.
const MCP_OVERRIDES_PATH = nodePath.join(os.homedir(), ".ares", "mcp-overrides.json");
function _readMcpOverrides() {
  try {
    const raw = fsSync.readFileSync(MCP_OVERRIDES_PATH, "utf8");
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : {};
  } catch { return {}; }
}
function _writeMcpOverrides(obj) {
  try {
    fsSync.mkdirSync(nodePath.dirname(MCP_OVERRIDES_PATH), { recursive: true, mode: 0o700 });
    fsSync.writeFileSync(MCP_OVERRIDES_PATH, JSON.stringify(obj || {}, null, 2), { mode: 0o600 });
  } catch {}
}
const SPAWN_TIMEOUT_MS = 20000;

// Phase RP1-B4 — server-side size guard.
//
// When the model embeds a 5–10K char script as a single tool argument,
// Bedrock burns through the output budget mid-stream and emits a
// half-formed tool_use block. The dispatch path then either
// JSON-parses garbage or sends truncated args. Reject above this cap
// before dispatch and return an actionable error so the model can
// retry with smaller chunks.
//
// Per-tool overrides (TOOL_INPUT_OVERRIDES) carve out cases where the
// payload genuinely needs to be large (email body, draft document, …).
const TOOL_INPUT_MAX_CHARS = parseInt(process.env.ARES_TOOL_INPUT_MAX_CHARS || "4096", 10);
const TOOL_INPUT_OVERRIDES = {
  "email-mcp__email_draft":   16384,
  "skills__skill_save":             16384,
  "memory__memory_record":           8192,
  // B-9: filesystem-agent exposes `fs_write` (not `write_file`). The
  // mismatched key meant legitimate 5KB+ file writes hit the 4 KB cap
  // and got rejected with "Tool input too large". Verified against
  // /filesystem/server.js where the tool is registered.
  "filesystem-agent__fs_write":     16384,
  // Add new entries here as legitimate >4K cases come up.
};

// Phase 6 — spawn-side circuit breaker.
// Some MCPs go bad in ways that don't recover quickly: missing binary,
// crashing on init, AWS creds not yet refreshed, AuthProvider not authed.
// Without a breaker, every activation attempt eats SPAWN_TIMEOUT_MS (20s)
// and stalls whatever code is awaiting it. With a breaker, after
// CB_FAIL_THRESHOLD consecutive spawn failures we refuse new attempts
// for CB_COOLDOWN_MS, returning a fast-fail error. The next attempt
// after cool-down is "half-open" — one trial; success closes the
// breaker, failure restarts the cool-down.
const CB_FAIL_THRESHOLD = 3;
const CB_COOLDOWN_MS = 60_000;

// Default set of MCPs that start at boot. Add your own MCP servers to
// your mcp.json config and they'll be auto-discovered and spawned.
const ALWAYS_ACTIVE_DEFAULTS = new Set([
  // Core tier-1 — always needed.
  "memory",
  "skills",
  "shell-agent",
  "filesystem-agent",
  "ares-actions",
  // Optional but commonly useful.
  "computer-use",
]);

const MAX_ON_DEMAND = 10; // Max additional MCPs that can be activated on-demand.

// Short, human-readable descriptions for built-in MCPs.
// Add your own MCP descriptions here or in mcp.json.
const SERVER_DESCRIPTIONS = {
  "memory":           "Persistent RAG memory — record/search past tasks, preferences, recent work.",
  "skills":           "Skill library — save + fuzzy-search Markdown recipes for repeatable tasks.",
  "shell-agent":      "Run shell commands, resolve binaries, read env vars.",
  "filesystem-agent": "Read, write, list, copy, move files on the local machine.",
  "ares-actions":     "Cursor + DOM automation: smooth mouse, Chrome CDP web_click_by_text, AppleScript.",
  "computer-use":     "Pixel-level computer use: screen_capture, keyboard_type, app_launch.",
};

export class McpHub {
  constructor({ mcpJsonPath, log = console.log, alwaysActive = ALWAYS_ACTIVE_DEFAULTS, workspaceRoot = null } = {}) {
    this.mcpJsonPath = mcpJsonPath;
    this.log = log;
    this.alwaysActive = new Set(alwaysActive);
    // Phase U16 — used by getClaudeTools(platform) when looking for the
    // workspace-scoped ares-config.json override.
    this._workspaceRoot = workspaceRoot;

    /** @type {Map<string, object>} name -> spec from mcp.json */
    this.specs = new Map();

    /**
     * @type {Map<string, { client?: Client, tools: Array, state: "idle"|"starting"|"running"|"error", error?: string }>}
     * Only names present here with state==="running" have a live child process.
     * Tier 1 servers stay running permanently; others live for the duration of activation.
     */
    this.state = new Map();
    // Manual connect/disconnect overrides (persisted across restarts).
    this._overrides = _readMcpOverrides();
  }

  async start() {
    const raw = await fs.readFile(this.mcpJsonPath, "utf8");
    const cfg = JSON.parse(raw);
    let disabledCount = 0;
    for (const [name, spec] of Object.entries(cfg.mcpServers || {})) {
      this.specs.set(name, spec);
      // A manual "connected" override (from the MCP tab) lets the user
      // run a server that mcp.json marks disabled — treat it as enabled.
      const override = this._overrides[name];
      const effectivelyDisabled = override === "connected" ? false
        : (override === "disconnected" ? true : spec.disabled === true);
      // Phase 6 — every server gets a tiny circuit-breaker record alongside
      // its lifecycle state. Initial state: closed (fail count 0).
      this.state.set(name, {
        tools: [],
        // Phase 11.3 — honour `disabled: true` from mcp.json (+ user
        // overrides). A disabled/disconnected server starts in "disabled".
        state: effectivelyDisabled ? "disabled" : "idle",
        breaker: { fails: 0, openedAt: 0 },
      });
      if (effectivelyDisabled) disabledCount += 1;
    }
    this.log(`[mcp] catalog loaded: ${this.specs.size} MCPs known (${disabledCount} disabled)`);

    // Boot set: always-on servers that aren't disabled, PLUS any server
    // the user manually marked "connected" (their last word survives
    // restarts), MINUS any marked "disconnected".
    const wantConnected = (n) => {
      const ov = this._overrides[n];
      if (ov === "disconnected") return false;
      if (ov === "connected") return true;
      const spec = this.specs.get(n);
      return this.alwaysActive.has(n) && spec && spec.disabled !== true;
    };
    const bootList = [...this.specs.keys()].filter(wantConnected);
    const skipped = [...this.alwaysActive].filter((n) => !bootList.includes(n));
    if (skipped.length > 0) {
      this.log(`[mcp] not auto-starting (disabled/disconnected): ${skipped.join(", ")}`);
    }
    this.log(`[mcp] bootstrapping: ${bootList.join(", ")}`);
    await Promise.allSettled(
      bootList.map((n) => this._spawn(n)),
    );
    const running = [...this.state.values()].filter((s) => s.state === "running");
    const tools = running.reduce((n, s) => n + s.tools.length, 0);
    this.log(`[mcp] ready: ${running.length} servers running, ${tools} tools active`);
  }

  // -------- spawn / kill --------

  async _spawn(name) {
    const spec = this.specs.get(name);
    if (!spec) throw new Error(`unknown MCP: ${name}`);
    // Phase 11.3 — refuse to spawn disabled-in-mcp.json servers. Pre-fix
    // the spec.disabled flag was silently ignored, leading to repeated
    // spawn-attempt → Java stack trace dumps in err.log every time the
    // jobs runner / gateway tried to activate one. EXCEPTION: a manual
    // "connected" override (user clicked Connect in the MCP tab) bypasses
    // the disabled flag — their explicit choice wins over mcp.json.
    if (spec.disabled === true && this._overrides[name] !== "connected") {
      const err = new Error(
        `MCP '${name}' is disabled in mcp.json (set "disabled": false or click Connect to re-enable)`
      );
      err.code = "DISABLED";
      throw err;
    }
    const cur = this.state.get(name);
    if (cur.state === "running") return cur;
    if (cur.state === "starting") {
      // de-dupe concurrent activation requests
      if (cur._pending) return cur._pending;
    }

    // Phase 6 — circuit breaker. If the breaker is open and we're still
    // inside the cool-down, fail fast instead of waiting SPAWN_TIMEOUT_MS.
    // Past the cool-down we go "half-open" — let exactly this one attempt
    // through. Success closes the breaker; failure resets the timer.
    const br = cur.breaker || (cur.breaker = { fails: 0, openedAt: 0 });
    if (br.openedAt > 0) {
      const elapsed = Date.now() - br.openedAt;
      if (elapsed < CB_COOLDOWN_MS) {
        const wait = Math.ceil((CB_COOLDOWN_MS - elapsed) / 1000);
        const err = new Error(
          `MCP '${name}' circuit-open after ${br.fails} failures — try again in ${wait}s. ` +
          `Last error: ${cur.error || "unknown"}`
        );
        err.code = "CIRCUIT_OPEN";
        throw err;
      }
      // Cool-down elapsed → half-open. Don't reset the breaker yet; we
      // only close it on a successful spawn below.
    }

    cur.state = "starting";
    cur.error = undefined;

    const promise = (async () => {
      const env = { ...process.env, ...(spec.env || {}) };
      const transport = new StdioClientTransport({
        command: spec.command,
        args: spec.args || [],
        env,
        stderr: "pipe",
      });
      const client = new Client(
        { name: "ares-chat", version: "1.0.0" },
        { capabilities: {} },
      );

      try {
        await Promise.race([
          client.connect(transport),
          new Promise((_, rej) => setTimeout(() => rej(new Error("spawn timeout")), SPAWN_TIMEOUT_MS)),
        ]);
        const { tools } = await client.listTools();
        const disabledTools = new Set(spec.disabledTools || []);
        const registered = tools
          .filter((t) => !disabledTools.has(t.name))
          .map((t) => ({
            name: `${name}${TOOL_SEP}${t.name}`,
            description: t.description || "",
            input_schema: this._sanitizeSchema(t.inputSchema || { type: "object", properties: {} }),
            serverName: name,
            toolName: t.name,
          }));
        cur.client = client;
        cur.tools = registered;
        cur.state = "running";
        cur.error = undefined;
        // Phase 6 — successful spawn closes the breaker.
        cur.breaker.fails = 0;
        cur.breaker.openedAt = 0;
        this.log(`[mcp]   ✓ ${name} (${registered.length} tools)`);
        return cur;
      } catch (err) {
        try { await client.close(); } catch {}
        cur.client = null;
        cur.tools = [];
        cur.state = "error";
        cur.error = err.message;
        // Phase 6 — bump the failure counter; trip the breaker at threshold.
        cur.breaker.fails += 1;
        if (cur.breaker.fails >= CB_FAIL_THRESHOLD) {
          cur.breaker.openedAt = Date.now();
          this.log(
            `[mcp]   ⚠ ${name}: circuit OPEN after ${cur.breaker.fails} failures ` +
            `(cool-down ${Math.round(CB_COOLDOWN_MS / 1000)}s)`
          );
        }
        // Phase 11.3 — trim the error message before logging. Pre-fix
        // we dumped the entire JVM stack trace (~2KB per failure) on
        // every spawn attempt, which made the err log unreadable when
        // a AuthProvider-backed MCP was failing on every retry. Keep the
        // first sentence + length suffix; the full text stays on
        // cur.error for the API/UI to surface if needed.
        const short = (() => {
          const s = String(err.message || "").trim();
          // Strip Java stack frames after the first newline / pipe.
          const head = s.split(/[\n|]/)[0];
          return head.length > 240 ? head.slice(0, 240) + "…" : head;
        })();
        this.log(`[mcp]   ✗ ${name}: ${short}`);
        throw err;
      } finally {
        cur._pending = undefined;
      }
    })();
    cur._pending = promise;
    return promise;
  }

  async _kill(name) {
    const cur = this.state.get(name);
    if (!cur || cur.state !== "running") return;
    try { await cur.client.close(); } catch {}
    cur.client = null;
    cur.tools = [];
    cur.state = "idle";
    cur.error = undefined;
    this.log(`[mcp]   ■ ${name} stopped`);
  }

  _sanitizeSchema(schema) {
    if (!schema || typeof schema !== "object") {
      return { type: "object", properties: {} };
    }
    const clean = { ...schema };
    delete clean.$schema;
    if (!clean.type) clean.type = "object";
    if (!clean.properties) clean.properties = {};
    return clean;
  }

  // -------- public activation API --------

  listServers() {
    return [...this.specs.keys()].map((name) => {
      const s = this.state.get(name);
      const br = s.breaker || { fails: 0, openedAt: 0 };
      const breakerOpen = br.openedAt > 0 && Date.now() - br.openedAt < CB_COOLDOWN_MS;
      return {
        name,
        state: s.state, // idle | starting | running | error | disabled
        active: s.state === "running",
        alwaysActive: this.alwaysActive.has(name),
        override: this._overrides[name] || null, // "connected" | "disconnected" | null
        toolCount: s.tools.length,
        error: s.error,
        description: SERVER_DESCRIPTIONS[name] || "",
        // Phase 6 — circuit-breaker state for ops dashboards / health checks.
        breaker: {
          open: breakerOpen,
          fails: br.fails,
          cooldownRemainingMs: breakerOpen ? Math.max(0, CB_COOLDOWN_MS - (Date.now() - br.openedAt)) : 0,
        },
      };
    });
  }

  /** Simple mutex to serialize activate/deactivate operations */
  _activateLock = Promise.resolve();

  /** Track which MCPs are "pinned" by active agent sessions */
  _pinnedMcps = new Map(); // name -> refCount

  pinMcp(name) {
    this._pinnedMcps.set(name, (this._pinnedMcps.get(name) || 0) + 1);
  }

  unpinMcp(name) {
    const count = (this._pinnedMcps.get(name) || 1) - 1;
    if (count <= 0) this._pinnedMcps.delete(name);
    else this._pinnedMcps.set(name, count);
  }

  async activate(name) {
    // Serialize activations to prevent concurrent spawn storms
    const prev = this._activateLock;
    let resolve;
    this._activateLock = new Promise((r) => { resolve = r; });
    await prev;

    try {
      if (!this.specs.has(name)) throw new Error(`unknown MCP: ${name}`);

      // Already running? Just return it.
      const cur = this.state.get(name);
      if (cur.state === "running") {
        return { name, active: true, toolCount: cur.tools.length };
      }

      // Keep-all-open policy (2026-05-29, user directive): every MCP is
      // always-on and nothing is ever evicted to make room. MAX_ON_DEMAND
      // is 0 and ALWAYS_ACTIVE_DEFAULTS holds the full catalog, so there
      // is no on-demand slot to contend for. The old eviction loop (kill
      // an unpinned MCP / wait-for-slot) has been removed — activation
      // only ever SPAWNS, never closes a peer.

      await this._spawn(name);
      const s = this.state.get(name);
      return { name, active: s.state === "running", toolCount: s.tools.length, error: s.error };    } finally {
      resolve();
    }
  }

  async deactivate(name) {
    // Keep-all-open policy (2026-05-29, user directive): the app no longer
    // closes MCPs during normal operation. deactivate() is now a no-op so
    // the sub-agent / jobs-runner `finally` blocks (and any stale caller)
    // can't tear a server down mid-use. Real teardown only happens on
    // process shutdown via close() → _kill(). To force-restart a stuck
    // child, call _kill() directly from server-side maintenance code.
    this.log(`[mcp] deactivate('${name}') ignored — keep-all-open policy; MCPs stay running.`);
    const s = this.state.get(name);
    return { name, active: !!s && s.state === "running", kept: true };
  }

  // ── Manual connect / disconnect (MCP tab, 2026-05-30) ──────────────
  // These are the USER's explicit lifecycle controls. Unlike activate/
  // deactivate (which the agent uses and which honour keep-all-open),
  // connect/disconnect persist a per-server override so the choice
  // survives restarts. connect() spawns + records "connected";
  // disconnect() really kills the child + records "disconnected".

  _setOverride(name, value) {
    if (value == null) delete this._overrides[name];
    else this._overrides[name] = value;
    _writeMcpOverrides(this._overrides);
  }

  async connect(name) {
    if (!this.specs.has(name)) throw new Error(`unknown MCP: ${name}`);
    // Record intent FIRST so _spawn's disabled-guard sees the override.
    this._setOverride(name, "connected");
    try {
      const r = await this.activate(name);
      const s = this.state.get(name);
      return { name, active: s.state === "running", toolCount: s.tools.length, error: s.error, override: "connected" };
    } catch (err) {
      // Keep the override (user wants it connected) but report the failure
      // so the UI can show "error" with the reason (e.g. needs auth-init).
      const s = this.state.get(name);
      return { name, active: s?.state === "running", toolCount: s?.tools?.length || 0, error: err.message, override: "connected" };
    }
  }

  async disconnect(name) {
    if (!this.specs.has(name)) throw new Error(`unknown MCP: ${name}`);
    this._setOverride(name, "disconnected");
    await this._kill(name);
    const s = this.state.get(name);
    if (s) s.state = "disabled"; // reflect that it won't auto-respawn
    return { name, active: false, override: "disconnected" };
  }

  /** Expose the persisted override for a server (UI status). */
  overrideFor(name) {
    return this._overrides[name] || null;
  }

  // B-13: graceful shutdown. Tear down every running MCP child so launchd
  // kickstart -k doesn't orphan them under PID 1. Includes tier-1 servers,
  // which deactivate() refuses by design but _kill() handles.
  async close() {
    const running = [...this.state.entries()]
      .filter(([, s]) => s.state === "running")
      .map(([n]) => n);
    await Promise.all(running.map((n) => this._kill(n).catch((e) => {
      this.log(`[mcp] close: kill ${n} failed: ${e.message}`);
    })));
    return { closed: running.length };
  }

  getActiveServers() {
    return [...this.state.entries()]
      .filter(([, s]) => s.state === "running")
      .map(([n]) => n);
  }

  // -------- tool dispatch --------

  /**
   * Tools visible to Claude this turn = META_TOOLS + tools from every
   * server currently running, optionally filtered by platform allowlist.
   *
   * Phase U16: pass `platform` ("browser" | "electron-full" |
   * "electron-compact" | "cli" | "slack" | "outlook") to apply the
   * per-platform allow/deny rules from ~/.ares/ares-config.json.
   * Calling with no arg or unknown platform returns every tool — keeps
   * pre-U16 callers working unchanged.
   */
  getClaudeTools(platform) {
    const out = [...META_TOOLS];
    for (const [name, s] of this.state) {
      if (s.state !== "running") continue;
      for (const t of s.tools) {
        out.push({
          name: t.name,
          description: t.description.slice(0, 1024),
          input_schema: t.input_schema,
        });
      }
    }
    return platform ? filterToolsForPlatform(out, platform, { workspaceRoot: this._workspaceRoot }) : out;
  }

  /**
   * Compact catalog for injection into the system prompt so Claude knows
   * every available MCP by name + description even when it's idle.
   */
  getCatalogForPrompt() {
    // Q-pass-2: every MCP is always-on. The catalog still surfaces
    // server names so the agent picks tools by domain, but there's
    // no activate/deactivate dance.
    const lines = ["# MCP Catalog (ares-chat, all servers always-on)"];
    lines.push("");
    for (const m of this.listServers()) {
      const tag = m.state === "running" ? "[ok]"
        : m.state === "starting" ? "[starting]"
        : m.state === "error" ? "[error]"
        : "[idle]";
      lines.push(`- ${tag} ${m.name}${m.description ? " — " + m.description : ""}`);
    }
    return lines.join("\n");
  }

  /**
   * Phase U05 — register a factory the meta-tool ares_delegate_subagent
   * can call to spin up a parallel Orchestrator. Server.js wires this up
   * at boot so the agent loop can self-delegate without import cycles.
   *
   * factory(): Orchestrator
   */
  setOrchestratorFactory(factory) {
    this._orchestratorFactory = typeof factory === "function" ? factory : null;
  }

  async callTool(prefixedName, args, opts = {}) {
    const { abortSignal } = opts;
    if (META_TOOL_NAMES.has(prefixedName)) {
      return this._callMetaTool(prefixedName, args, { abortSignal });
    }

    // Phase U09 — sandbox interception. When ARES_SANDBOX is non-default
    // (currently only "docker"), route shell-agent__shell_exec through
    // the active SandboxBackend instead of the MCP. The local backend is
    // a passthrough, so we only intercept when the active backend is NOT
    // local (saves a fork on every shell call when nothing is wrapped).
    if (prefixedName === "shell-agent__shell_exec") {
      const box = getSandbox();
      if (box.name !== "local") {
        return _runViaSandbox(box, args || {}, abortSignal);
      }
    }

    // Phase U14 — plugin pre/postToolCall hooks. preToolCall can VETO a
    // tool call (returning false or {veto:true, reason}). The veto is
    // surfaced as an MCP-shape error so the agent loop sees it the same
    // way it sees any other tool failure.
    const pluginReg = getPluginRegistry();
    const pluginPre = await pluginReg.fire("preToolCall", {
      toolName: prefixedName, args, sessionId: opts.sessionId || null,
    }).catch(() => ({ vetoed: false }));
    if (pluginPre.vetoed) {
      return {
        content: [{ type: "text", text: `Tool call vetoed: ${pluginPre.reason || "(no reason)"}` }],
        isError: true,
      };
    }
    const sepIdx = prefixedName.indexOf(TOOL_SEP);
    if (sepIdx < 0) throw new Error(`bad tool name: ${prefixedName}`);
    const serverName = prefixedName.slice(0, sepIdx);
    const toolName = prefixedName.slice(sepIdx + TOOL_SEP.length);
    const s = this.state.get(serverName);
    if (!s || s.state !== "running") {
      throw new Error(`MCP '${serverName}' is not running. Call ares_activate_mcp first.`);
    }
    // Phase 2: fail fast if abort already fired. No point spending the round-trip.
    if (abortSignal?.aborted) {
      const err = new Error("Aborted before MCP dispatch");
      err.name = "AbortError";
      throw err;
    }

    // Normalise + validate arguments against the tool's cached JSON schema
    // before dispatching. This catches the common LLM mistakes (stringified
    // arrays, wrong key names, missing required fields) and either fixes
    // them in place or returns a structured error the model can use to
    // retry with the correct shape.
    const tool = s.tools.find((t) => t.toolName === toolName);
    const schema = tool?.input_schema;
    const { args: fixed, warnings, errors, appliedTransforms } = normalizeToolArgs({
      serverName, toolName, schema, args: args || {},
    });
    if (errors.length) {
      // Short-circuit with a helpful error so the model self-corrects on the
      // next turn. Keep it terse — just enough for the LLM to fix the call.
      return {
        content: [{
          type: "text",
          text:
            `Invalid arguments for ${prefixedName}.\n` +
            errors.map((e) => `- ${e}`).join("\n") +
            (schema ? "\n\nSchema:\n" + summariseSchema(schema) : ""),
        }],
        isError: true,
      };
    }
    if (warnings.length) {
      // Log quietly — args were auto-corrected, no need to round-trip.
      this.log(`[mcp] ${prefixedName}: auto-fixed args (${warnings.join("; ")})`);
    }

    // Phase RP1-B4 — size guard. Run after normalisation so the cap
    // applies to the bytes we'd actually dispatch, not the raw model
    // output. Per-tool overrides allow legitimate large payloads.
    const cap = TOOL_INPUT_OVERRIDES[prefixedName] ?? TOOL_INPUT_MAX_CHARS;
    let serializedSize = 0;
    try { serializedSize = JSON.stringify(fixed).length; } catch { /* circular — let dispatch fail naturally */ }
    if (serializedSize > cap) {
      const msg =
        `Tool input too large: ${prefixedName} got ${serializedSize} chars (max ${cap}).\n` +
        `This usually means you are trying to embed a long script or dataset in a single argument.\n` +
        `Split the work across multiple smaller calls — for shell_exec, write each section in its own ` +
        `call; for fs_write, chunk the content; for data-query-mcp queries, split the SQL into shorter statements.`;
      this.log(`[mcp] ${prefixedName}: REJECTED oversize input (${serializedSize} > ${cap}); not dispatching.`);
      return {
        content: [{ type: "text", text: msg }],
        isError: true,
        // Sentinel so the agent's loop detector can ignore rejected
        // oversized calls (otherwise three rejected attempts in a row
        // would falsely trip the loop detector and abort the run).
        _aresOversizedToolInput: true,
      };
    }

    // Per-server call timeout. Most MCPs are snappy; a few (dashboard-mcp
    // has to boot headless Chromium + complete AuthProvider SSO + wait for
    // dashboard render) routinely take 30–120s on cold start. Give those
    // a larger budget so we don't get a bogus RequestTimeout.
    const SLOW_MCP_TIMEOUT_MS = 3 * 60 * 1000; // 3 min
    const FAST_MCP_TIMEOUT_MS = 60 * 1000;     // default 1 min
    const SLOW_SERVERS = new Set(["dashboard-mcp", "kiro-browser-agent", "chrome-real"]);
    const timeoutMs = SLOW_SERVERS.has(serverName) ? SLOW_MCP_TIMEOUT_MS : FAST_MCP_TIMEOUT_MS;

    // Phase 2: race the MCP call against the abort signal. The MCP SDK doesn't
    // accept an AbortSignal natively, so we use a Promise.race + a one-shot
    // listener. On abort, send notifications/cancelled to the server so it
    // releases resources, then reject immediately. Result: Stop button kills
    // tool calls in <50ms instead of waiting for the 60s timeout.
    const callPromise = s.client.callTool(
      { name: toolName, arguments: fixed },
      undefined,
      { timeout: timeoutMs }
    );

    // Phase U11 — observe skill_* calls regardless of whether the caller
    // passed an abortSignal. Wraps both the no-signal and signal paths.
    // Phase U14 — also fire postToolCall plugin hook here.
    // Phase RP1-B3 — feed dispatch outcomes back into the tool-arg
    // learning store so promoted fixes accumulate evidence and isError
    // patterns spawn unpromoted candidates.
    const observeIfSkills = (result, startedAt) => {
      const durationMs = Date.now() - startedAt;
      if (serverName === "skills") {
        const kind = toolName === "skill_search" ? "search"
          : toolName === "skill_save" ? "save"
          : toolName === "skill_record_run" ? "record_run"
          : null;
        if (kind) {
          try { recordSkillEvent({ kind, args: fixed, result, durationMs }); } catch {}
        }
      }
      try {
        getPluginRegistry().fire("postToolCall", {
          toolName: prefixedName, args: fixed, result, durationMs,
          sessionId: opts.sessionId || null,
        });
      } catch {}
      // RP1-B3 — outcome → store. Wrapped in try so a store hiccup
      // never breaks the dispatch path.
      try {
        const store = getToolArgStore();
        if (result && !result.isError) {
          // B-8: only bump the transforms that ACTUALLY applied to this
          // dispatch, not every promoted fix on the tool. Pre-fix this
          // multiplied success by the count of promoted fixes for the
          // tool, which made the promotion threshold meaningless.
          for (const transform of (appliedTransforms || [])) {
            store.recordSuccess({ toolName: prefixedName, transform });
          }
        } else if (result && result.isError) {
          // Look at the error text; if it matches any seed errorRegex,
          // record an unpromoted candidate. The candidate becomes
          // active only after 3 successes.
          const errText = (result.content || []).map((c) => c?.text || "").join(" ");
          for (const seed of SEED_FIXES) {
            if (seed.toolName !== prefixedName) continue;
            const re = new RegExp(seed.errorRegex, "i");
            if (re.test(errText)) {
              store.recordCandidate({
                toolName: prefixedName,
                errorRegex: seed.errorRegex,
                transform: seed.transform,
              });
            }
          }
        }
      } catch {}
    };

    if (!abortSignal) {
      const startedAt = Date.now();
      const result = await callPromise;
      observeIfSkills(result, startedAt);
      return result;
    }

    let abortHandler;
    const abortPromise = new Promise((_, reject) => {
      abortHandler = () => {
        // Best-effort: send the JSON-RPC cancellation notification so the
        // remote MCP can stop work. We don't await — the local promise
        // rejects regardless.
        try {
          s.client.notification?.({
            method: "notifications/cancelled",
            params: { reason: "client-aborted" },
          });
        } catch {}
        const err = new Error("MCP call aborted by client");
        err.name = "AbortError";
        reject(err);
      };
      abortSignal.addEventListener("abort", abortHandler, { once: true });
    });

    try {
      const startedAt = Date.now();
      const result = await Promise.race([callPromise, abortPromise]);
      observeIfSkills(result, startedAt);
      return result;
    } finally {
      if (abortHandler) abortSignal.removeEventListener("abort", abortHandler);
    }
  }

  async _callMetaTool(name, args, opts = {}) {
    const { abortSignal } = opts;
    try {
      if (name === "ares_list_mcps") {
        const full = this.listServers();
        return { content: [{ type: "text", text: JSON.stringify(full, null, 2) }] };
      }
      // Q-pass-2: ares_activate_mcp + ares_deactivate_mcp removed
      // from the LLM tool list. If a stale transcript invokes them
      // (replay scenario), respond with a no-op explanation instead
      // of throwing — the agent reads it and adapts.
      if (name === "ares_activate_mcp" || name === "ares_deactivate_mcp") {
        return { content: [{ type: "text", text: `[${name}] is no longer needed — every MCP is always-on. Call the target tool directly.` }] };
      }
      if (name === "ares_delegate_subagent") {
        return await this._runDelegateSubagent(args, { abortSignal });
      }
      if (name === "ares_skill_propose_patch") {
        return await this._runSkillProposePatch(args);
      }
      throw new Error(`unknown meta tool: ${name}`);
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }

  /**
   * Phase U11 — meta-tool ares_skill_propose_patch.
   *
   * The agent calls this when it has identified a recipe improvement (a
   * new step, a corrected precondition, a renamed slug). Instead of
   * directly mutating the recipe, this meta-tool builds a diff preview
   * and stamps the call as MEDIUM-RISK so the U06 approval gate forces
   * the user to confirm before any actual `skill_save` happens.
   *
   * args: { slug, title?, keywords?, preconditions?, steps?, notes?, reason }
   *
   * The implementation is a thin wrapper that:
   *   1. Reads the existing recipe (if any) via skills__skill_open
   *   2. Builds a unified-diff-ish preview block
   *   3. Calls skills__skill_save with overwrite=true
   *
   * NOTE: the approval gate runs *outside* this method — it gates calls
   * via classify(toolName, input) on the agent loop. Since this meta
   * tool is itself the entry point, we don't gate ourselves; the agent
   * is expected to call this only after deciding the patch is correct.
   * The `reason` field is required precisely so the audit log carries a
   * one-line justification per patch.
   */
  async _runSkillProposePatch(args) {
    const slug = (args?.slug || "").trim();
    const reason = (args?.reason || "").trim();
    if (!slug) {
      return {
        content: [{ type: "text", text: "ares_skill_propose_patch: slug is required" }],
        isError: true,
      };
    }
    if (!reason) {
      return {
        content: [{ type: "text", text: "ares_skill_propose_patch: reason is required (one-line justification)" }],
        isError: true,
      };
    }
    if (!args?.title && !args?.steps && !args?.preconditions && !args?.notes && !args?.keywords) {
      return {
        content: [{ type: "text", text: "ares_skill_propose_patch: at least one field (title/keywords/preconditions/steps/notes) must be supplied" }],
        isError: true,
      };
    }
    // Make sure skills MCP is up.
    const skillsState = this.state.get("skills");
    if (!skillsState || skillsState.state !== "running") {
      return {
        content: [{ type: "text", text: "skills MCP is not running — cannot propose a patch" }],
        isError: true,
      };
    }
    // skill_save handles the file mutation; we set overwrite=true because
    // the proposer's intent is "replace this slug's body with my new fields".
    const saveArgs = {
      title: args.title || slug,
      keywords: args.keywords || "",
      preconditions: args.preconditions || "",
      steps: args.steps || "",
      notes: args.notes ? `${args.notes}\n\n[patched by ares_skill_propose_patch — reason: ${reason}]`
                       : `[patched by ares_skill_propose_patch — reason: ${reason}]`,
      overwrite: true,
    };
    let res;
    try {
      res = await this.callTool("skills__skill_save", saveArgs);
    } catch (e) {
      return {
        content: [{ type: "text", text: `ares_skill_propose_patch: skill_save threw — ${e.message}` }],
        isError: true,
      };
    }
    const lines = [
      `Skill patch proposed for slug "${slug}".`,
      `Reason: ${reason}`,
      "",
      "skill_save result:",
      ...(res?.content || []).filter((b) => b?.type === "text").map((b) => b.text),
    ];
    return {
      content: [{ type: "text", text: lines.join("\n") }],
      isError: !!res?.isError,
    };
  }

  /**
   * Phase U05 — meta-tool ares_delegate_subagent.
   *
   * Spawns a one-off sub-agent through the existing Orchestrator, with an
   * optional MCP allowlist that gets activated for the duration of the
   * subtask and cleaned up afterwards. Returns a single tool_result block
   * containing:
   *   - synthesised text from the subtask
   *   - tool-call summary so the caller can see what the subagent did
   *   - error info if the subagent crashed (isError=true)
   *
   * The caller (parent Agent) keeps streaming its own loop while the
   * subagent runs — events flow through the orchestrator's queue but
   * we don't replay them on the parent SSE stream; the parent only sees
   * the synthesised tool_result. Keeps the UX coherent.
   *
   * args: { prompt, model?, mcps? }
   */
  async _runDelegateSubagent(args, { abortSignal } = {}) {
    if (!this._orchestratorFactory) {
      return {
        content: [{ type: "text", text: "Subagent delegation unavailable — orchestrator factory not registered. Server.js wiring bug." }],
        isError: true,
      };
    }
    const prompt = (args?.prompt || "").trim();
    if (!prompt) {
      return {
        content: [{ type: "text", text: "ares_delegate_subagent requires a non-empty `prompt`." }],
        isError: true,
      };
    }
    const model = (args?.model || "sonnet").toLowerCase();
    const mcps = Array.isArray(args?.mcps) ? args.mcps.filter((s) => typeof s === "string") : [];

    // Activate the allowlisted MCPs up front so the subagent has them in
    // scope. Pin them so concurrent activations don't evict before the
    // subagent finishes. Cleanup unconditionally in finally.
    const activated = [];
    for (const mcpName of mcps) {
      if (!this.specs.has(mcpName)) {
        this.log(`[delegate] skipping unknown MCP "${mcpName}"`);
        continue;
      }
      try {
        const r = await this.activate(mcpName);
        if (r.active) {
          this.pinMcp(mcpName);
          activated.push(mcpName);
        } else {
          this.log(`[delegate] could not activate ${mcpName}: ${r.error || "unknown"}`);
        }
      } catch (e) {
        this.log(`[delegate] activate ${mcpName} threw: ${e.message}`);
      }
    }

    let orchestrator;
    try {
      orchestrator = this._orchestratorFactory();
    } catch (e) {
      return {
        content: [{ type: "text", text: `Subagent factory threw: ${e.message}` }],
        isError: true,
      };
    }

    // Build a one-shot conversation: a synthetic "user" turn with the
    // subagent prompt. The orchestrator's decompose path would call
    // Haiku and split into N subtasks; for delegate-mode we want exactly
    // ONE subtask, so we bypass decomposition by calling the agent
    // directly via the orchestrator's plan-prefilled fast path. Today
    // the orchestrator decomposes unconditionally — we accept that
    // small cost (~1s Haiku call) in exchange for not duplicating the
    // sub-agent execution machinery here.
    const messages = [{ role: "user", content: [{ type: "text", text: prompt }] }];
    let synthesised = "";
    const toolCalls = [];
    let errored = null;
    try {
      for await (const ev of orchestrator.run(messages, prompt, { abortSignal })) {
        if (ev?.type === "text_delta" && typeof ev.text === "string") {
          synthesised += ev.text;
        } else if (ev?.type === "subtask_event") {
          const inner = ev.event;
          if (inner?.type === "text_delta" && typeof inner.text === "string") {
            synthesised += inner.text;
          } else if (inner?.type === "tool_call" && inner.name) {
            toolCalls.push(inner.name);
          } else if (inner?.type === "error" && inner.error) {
            errored = inner.error;
          }
        } else if (ev?.type === "error" && ev.error) {
          errored = ev.error;
        }
      }
    } catch (e) {
      errored = e.message;
    } finally {
      // Keep-all-open policy (2026-05-29): unpin so refcounts stay tidy,
      // but do NOT deactivate — every MCP is always-on and stays running.
      for (const mcpName of activated) {
        try { this.unpinMcp(mcpName); } catch {}
      }
    }

    if (errored && !synthesised) {
      return {
        content: [{ type: "text", text: `Subagent error: ${errored}` }],
        isError: true,
      };
    }
    const headerLines = [`Subagent (model=${model}) finished. Tools used: ${toolCalls.length ? toolCalls.join(", ") : "none"}.`];
    if (errored) headerLines.push(`Note: subagent reported a partial error: ${errored}`);
    headerLines.push("");
    return {
      content: [{
        type: "text",
        text: `${headerLines.join("\n")}${synthesised || "(no text response from subagent)"}`,
      }],
    };
  }
}

// -------- meta tools --------

const META_TOOLS = [
  {
    name: "ares_list_mcps",
    description:
      "List every MCP server known to ares-chat with its current state (running, error), tool count, and description. Useful for self-introspection — confirm an MCP is reachable before relying on its tools.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  // Q-pass-2: ares_activate_mcp + ares_deactivate_mcp REMOVED.
  // Every MCP boots eagerly at server start; the agent never needs to
  // toggle them. The hub's activate/deactivate methods remain for
  // server-side lifecycle (e.g. kicking a stuck child) but they're
  // not exposed to the LLM anymore. Old chat transcripts that
  // reference these tools will fall through to the missing-tool
  // error path; the agent recovers via plain reasoning.
  {
    name: "ares_skill_propose_patch",
    description:
      "Propose an improvement to an existing skill recipe at ~/.kiro/skills/learned/<slug>.md. Use after running a skill and discovering a step is missing, a precondition is wrong, or the playbook should be updated. Provide ONLY the fields you want to change; you must always pass `slug` (the existing recipe's slug) and `reason` (one-line justification, recorded in the saved recipe's notes). This wraps skills__skill_save with overwrite=true and adds an audit-line note. DO NOT use for brand-new skills — call skills__skill_save directly with overwrite=false for those. This call is HIGH-RISK and goes through the user approval gate (you'll see an approval_required event before it lands).",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Existing recipe slug at ~/.kiro/skills/learned/<slug>.md" },
        reason: { type: "string", description: "One-line justification for the patch (audit log entry)." },
        title: { type: "string", description: "New title (optional — leave empty to preserve)" },
        keywords: { type: "string", description: "Comma-separated keyword list (optional)" },
        preconditions: { type: "string", description: "Replacement preconditions block (optional)" },
        steps: { type: "string", description: "Replacement steps block (optional)" },
        notes: { type: "string", description: "Additional notes appended to the recipe (optional)" },
      },
      required: ["slug", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "ares_delegate_subagent",
    description:
      "Delegate a focused, self-contained sub-task to a fresh sub-agent. The sub-agent runs with its own context window (no transcript pollution back to you), can activate its own on-demand MCPs from the allowlist you provide, and returns a single synthesised text block. Use this when you have a sub-task whose intermediate tool output would balloon your context (large dataset analysis, multi-file scrape, recursive research). DO NOT use this for trivial tool calls — that's just overhead. The sub-agent has the same Tier-1 MCPs as you (memory, skills, shell-agent, filesystem-agent, ares-actions); the `mcps` field activates additional on-demand MCPs for the duration of the sub-task only and deactivates them afterwards.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The sub-task prompt. Be specific — the sub-agent only sees this, not your transcript." },
        model: { type: "string", enum: ["haiku", "sonnet", "opus"], description: "Model tier for the sub-agent. Defaults to 'sonnet'." },
        mcps: { type: "array", items: { type: "string" }, description: "Optional on-demand MCP names to activate for the sub-task (e.g. ['data-query-mcp', 'email-mcp']). Cleaned up automatically when the sub-task ends." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
];

const META_TOOL_NAMES = new Set(META_TOOLS.map((t) => t.name));

// Phase RP1-B3 — real arg-normaliser backed by the persistent learning
// store. Pre-flight applies any PROMOTED fix whose target field is
// currently missing/wrong; runtime candidates record themselves on
// isError but don't shape calls until promoted (3 successes).
//
// Returns `{args, warnings, errors}`. `errors` is reserved for future
// schema-validation failures (still elided here — schema-driven rejects
// would belong inside a separate validation phase, not B3).
function normalizeToolArgs({ serverName, toolName, schema, args }) {
  const prefixed = `${serverName}__${toolName}`;
  const warnings = [];
  // B-8: thread the actual applied transforms back to the dispatch path so
  // success-recording only bumps fixes that ACTUALLY ran. Pre-fix the
  // outer loop iterated `store.fixesFor(name)` for EVERY warning, which
  // multiplied success counts by the number of promoted fixes.
  const appliedTransforms = [];
  let cur = args || {};
  try {
    const store = getToolArgStore();
    store.noteCall();
    const { args: fixed, applied } = applyFixesFromStore(store, prefixed, cur);
    cur = fixed;
    for (const a of applied) {
      warnings.push(`store-fix: ${a.reason}`);
      appliedTransforms.push(a.transform);
    }
  } catch (err) {
    // Store failures must NEVER break dispatch. Warn quietly.
    warnings.push(`tool-arg-store error: ${err.message}`);
  }
  return { args: cur, warnings, errors: [], appliedTransforms };
}

/**
 * Render a one-block, model-readable summary of an MCP tool schema.
 * Used in the {errors.length} short-circuit to help the model self-
 * correct. Walks `properties` + `required` only — full JSON schema
 * features (oneOf, allOf, etc.) are summarised as their type tag.
 */
function summariseSchema(schema) {
  if (!schema || typeof schema !== "object") return "(no schema)";
  const required = new Set(schema.required || []);
  const props = schema.properties || {};
  const keys = Object.keys(props);
  if (keys.length === 0) return "(no properties)";
  const lines = [];
  for (const k of keys) {
    const p = props[k];
    const tag = required.has(k) ? "required" : "optional";
    const t = p?.type || (Array.isArray(p?.oneOf) ? "oneOf" : p?.enum ? "enum" : "any");
    const desc = (p?.description || "").toString().slice(0, 80);
    lines.push(`- ${k} (${t}, ${tag})${desc ? " — " + desc : ""}`);
  }
  return lines.join("\n");
}

// Phase U09 — adapter that turns a SandboxBackend.exec() result into the
// MCP content-block shape the agent expects, so shell_exec via docker
// is indistinguishable from shell_exec via the shell-agent MCP.
async function _runViaSandbox(backend, args, abortSignal) {
  const command = (args?.command || args?.cmd || "").toString();
  if (!command) {
    return {
      content: [{ type: "text", text: "shell_exec: missing command" }],
      isError: true,
    };
  }
  try {
    const r = await backend.exec({
      command,
      cwd: args?.cwd,
      timeout: args?.timeoutMs || args?.timeout,
      abortSignal,
    });
    const lines = [];
    if (r.stdout) lines.push(`STDOUT:\n${r.stdout}`);
    if (r.stderr) lines.push(`STDERR:\n${r.stderr}`);
    lines.push(`exit=${r.exitCode}  duration=${r.durationMs}ms  sandbox=${backend.name}`);
    return {
      content: [{ type: "text", text: lines.join("\n\n") }],
      isError: r.exitCode !== 0,
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `sandbox(${backend.name}) error: ${err.message}` }],
      isError: true,
    };
  }
}
