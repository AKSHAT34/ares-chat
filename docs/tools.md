# Tools / MCPs

## MCP catalog

Read from `<workspace>/.kiro/settings/mcp.json` at boot. Add any MCP server
to that file and it will be discovered and made available to the agent.

### Tier 1 (always running)

Spawned at boot, never killed:

- `memory` — persistent RAG memory (record/search past tasks, prefs).
- `skills` — skill library (Markdown recipes at `~/.kiro/skills/learned`).
- `shell-agent` — shell exec, env, binary resolution.
- `filesystem-agent` — read/write/list/copy/move local files.
- `ares-actions` — desktop automation: cursor, Chrome CDP, AppleScript.

### On-demand

Spawned by `ares_activate_mcp(<name>)`, killed by `ares_deactivate_mcp`
or auto-evicted at the configured cap. The catalog is injected into the
system prompt so the agent picks the narrowest tool for each task.

Per-server **circuit breaker**: 3 consecutive spawn failures → 60s
cool-down before the next attempt.

## Meta-tools

Always in scope:

- `ares_list_mcps` — full catalog with state.
- `ares_activate_mcp({name})` — spawn an idle MCP.
- `ares_deactivate_mcp({name})` — kill it.
- `ares_delegate_subagent({prompt, model?, mcps?})` — fresh sub-agent
  with its own context window.
- `ares_skill_propose_patch({slug, reason, ...changed-fields-only})` —
  propose an improvement to a recipe; HIGH-risk, gated by approval.

## Tool dispatch path

`hub.callTool(prefixedName, args, opts)` flow:

1. Meta-tool? → `_callMetaTool(...)`.
2. Sandbox interception: if `prefixedName === "shell-agent__shell_exec"`
   AND active backend ≠ local → route through the sandbox backend.
3. Plugin `preToolCall` hook — can VETO; veto becomes an `isError` result.
4. Per-tool arg normaliser.
5. Slow-MCP-aware timeout (3 min for browser-driving MCPs; 60s otherwise).
6. Race against `abortSignal` — sends `notifications/cancelled` on abort.
7. Skills telemetry recording for `skills__*` calls.
8. Plugin `postToolCall` hook.

## Per-platform filtering

`hub.getClaudeTools(platform)` filters via `lib/platforms.js`:

- `browser`, `electron-full` — permissive (allow:[*]).
- `electron-compact`, `cli` — drop browser/computer-use tools.
- `slack`, `outlook` — strict allowlist (read-only posture for inbound
  gateway runs).

Config at `~/.ares/ares-config.json` (workspace overrides via
`<workspace>/.ares/ares-config.json`).

## Sandbox backends

`ARES_SANDBOX=local|docker` (default `local`). The Docker backend runs each
`shell_exec` in an ephemeral container: `--network=none`, `--read-only`,
tmpfs `/work` + `/tmp`, `--user 1000:1000`, `--memory 512m`,
`--security-opt no-new-privileges`. Image: `alpine:3.19` (override via
`ARES_SANDBOX_IMAGE`).

Switch live via `POST /api/sandbox/switch {name}`.
