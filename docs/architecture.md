# Architecture


```
┌───────────────────────────────────────────────────────────────────────┐
│                        ares-app (Electron 32)                          │
│   pet (floating)   compact (chat panel)   full (loads 127.0.0.1:7777) │
│        ▲                  ▲                    ▲                       │
│        └──────────────────┼────────────────────┘                       │
│                           │ HTTP/SSE on localhost:7777                 │
└───────────────────────────┼───────────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────────┐
│                      ares-chat (Express + SSE)                         │
│  /api/chat      /api/sessions    /api/runs/pending-approvals           │
│  /api/jobs      /api/gateway     /api/sandbox  /api/transcribe         │
│  /api/commands  /api/personalities  /api/plugins  /api/doctor          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Agent (ReAct loop, ContextEngine, ApprovalGate, plugins)      │    │
│  │   ↓                                                            │    │
│  │ McpHub  →  Tier-1 MCPs (memory, skills, shell-agent, fs, ares-actions) │
│  │           on-demand MCPs (lazy spawn)                 │    │
│  │   ↓                                                            │    │
│  │ Bedrock driver (Claude Opus/Sonnet/Haiku)                     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  Sub-systems: JobRunner, GatewayManager, SandboxBackend,              │
│               PluginRegistry, Skills telemetry, persona files          │
└───────────────────────────────────────────────────────────────────────┘
```

## Top-level processes

- **`ares-chat`** (Node 22, ESM, port 7777) — the brain. Single Express
  process. Owns sessions, jobs, gateway, plugins, sandbox.
- **`ares-app`** (Electron 32) — the cockpit. Three windows; tray menu.
  Connects to `ares-chat` over HTTP/SSE on `127.0.0.1:7777`. **Does NOT
  spawn the server** — launchd manages that.
- **`ares-actions`**, **`memory`**, **`skills`**, **`filesystem-agent`**,
  **`shell-agent`** — Tier-1 MCP child processes started by the hub at
  boot. Spoken-to over stdio JSON-RPC.

## Hot paths

1. **User types in browser** → `POST /api/chat` → Agent.run() → MCP tool
   dispatch → Bedrock stream → SSE back to UI.
2. **Slack mention arrives** → GatewayManager poll → GatewaySession →
   Agent.run() with `auto-deny` approvalGate → reply → chat-mcp
   `post_draft` → user reviews + sends manually.
3. **Cron fires a job** → JobRunner → generic agent handler →
   delivery (`browser-toast` / `chat-mcp` / `email-mcp` drafts).

## Boot sequence (server.js)

1. `hub = new McpHub(...)` — load catalog from `.kiro/settings/mcp.json`.
2. `await hub.start()` — spawn Tier-1 MCPs.
3. `hub.setOrchestratorFactory(...)` — wire delegate-subagent meta-tool.
4. Load plugins from `~/.ares/plugins/` + `<workspace>/.ares/plugins/`.
5. `gatewayManager.applyConfig(readGatewayConfig()); gatewayManager.start()`
   — inert by default; user opts in via `~/.ares/gateway.json`.
6. `jobRunner = new JobRunner(...)`; `jobRunner.start()` — cron tick.
7. `app.listen(7777)`.

## File layout

See [tools.md](tools.md) for the MCP catalog, [sessions.md](sessions.md)
for transcript storage, [bedrock.md](bedrock.md) for the LLM driver.
