# Ares Documentation

Ares is a local autonomous agent — a single-user Bedrock Claude driver
with MCP tool access, persistent memory, structured personas, and a
gated approval flow for destructive actions.

## Layout

This `docs/` directory is plain markdown. Read inline in your editor.

## Pages

- [Architecture](architecture.md) — boxes-and-arrows view of the server + the MCP catalog.
- [Agent loop](agent-loop.md) — ReAct cycle, context engine, approval gate, plugin hooks.
- [Tools](tools.md) — MCP catalog, lazy spawn, sandbox interception, per-platform filtering, meta-tools.

## Feature overview

| Feature | Status |
| --- | --- |
| Bedrock model registry | ✓ |
| Pluggable ContextEngine | ✓ |
| Bedrock prompt caching | ✓ |
| Sub-agent delegation tool | ✓ |
| Approval / dangerous-command classifier | ✓ |
| CLI front-end | ✓ |
| ACP adapter | ✓ |
| Inbound gateway (drafts only) | ✓ |
| Cron jobs run the full agent | ✓ |
| Sandboxed terminal (local + Docker) | ✓ |
| Trajectory export (ShareGPT) | ✓ |
| Skills self-improvement | ✓ |
| Structured memory (SOUL/USER/MEMORY) | ✓ |
| Slash commands + personalities | ✓ |
| Plugin loader | ✓ |
| Voice transcription | ✓ |
| Per-platform tool toggle | ✓ |
| Setup wizard | ✓ |
| Doctor command | ✓ |
| Electron shell | ✓ |

## Design notes

- **Bedrock-focused**: the model registry targets AWS Bedrock. Adding other
  providers (Anthropic-direct, OpenAI, etc.) means extending `lib/llm/`.
- **Local-first**: auth is localhost-only with a bearer token; there are no
  public webhook handlers or external ingress paths by default.
- **Single-user**: no multi-tenant accounts. Metrics stay on localhost.
