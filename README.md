# Ares Chat

A local AI chat agent with a full cognitive stack: MCP (Model Context Protocol) integration, per-session RAG, persistent cross-session memory, knowledge graph, skills library, and multi-model support — powered by AWS Bedrock Claude.

## Features

- **Multi-session chat** with persistent history and per-session vector search (RAG)
- **MCP Hub** — connect any MCP server and its tools become available to the agent
- **Two-tier memory** — session-level RAG + cross-session journal with tree/vector/hybrid search
- **Skills library** — save and replay task recipes (Markdown playbooks)
- **Knowledge graph** — auto-built entity/relationship graph across sessions
- **Agent loop** with tool dispatch, approval gates, and sub-agent delegation
- **Infographic output** — charts, KPI cards, and tables rendered inline
- **Voice input** — transcribe audio via Whisper
- **Sandbox mode** — optionally run shell commands inside Docker
- **Gateway** — route messages from Slack, Outlook, or other platforms
- **Jobs/Cron** — scheduled background tasks with a built-in runner
- **Observability** — Prometheus metrics, ring-buffer diagnostics
- **Modern UI** — React-based chat interface with themes, command palette, and animations

## Prerequisites

- **Node.js** >= 20
- **AWS credentials** configured (for Bedrock Claude access)
- **MCP servers** you want to connect (configured in `mcp.json`)

## Quick Start

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/ares-chat.git
cd ares-chat
npm install

# Configure
cp .env.example .env
# Edit .env with your AWS region and profile

# Create your MCP config
cp mcp.json.example mcp.json
# Edit mcp.json to add your MCP servers

# Run
npm start
# Open http://127.0.0.1:7777
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARES_CHAT_PORT` | `7777` | HTTP server port |
| `AWS_REGION` | `us-west-2` | AWS Bedrock region |
| `AWS_PROFILE` | (default) | AWS credentials profile |
| `ARES_MODEL_ID` | `us.anthropic.claude-sonnet-4-20250514` | Bedrock model ID |
| `ARES_WORKSPACE` | `~/workspace` | Root workspace path |
| `ARES_SANDBOX` | `local` | Sandbox mode: `local` or `docker` |

### MCP Configuration

Create a `mcp.json` file in your workspace at `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/server.js"],
      "env": {}
    },
    "filesystem-agent": {
      "command": "node",
      "args": ["/path/to/filesystem-mcp/server.js"],
      "env": {}
    }
  }
}
```

## Architecture

```
server.js          — Express HTTP server + WebSocket SSE streaming
lib/
  agent.js         — Core agent loop (tool dispatch, context management)
  mcp-client.js    — MCP hub (spawn, connect, tool routing)
  bedrock.js       — AWS Bedrock Claude driver (re-export shim)
  llm/             — LLM drivers and model registry
  system-prompt.js — System prompt assembly with per-layer caps
  session-rag.js   — Per-session SQLite + vector search
  memory-hooks.js  — Auto-record to cross-session memory
  orchestrator.js  — Multi-turn orchestration and sub-agents
  context/         — Context window management (anchor, truncate)
  gateway/         — Multi-platform message routing
  jobs/            — Cron-based background task runner
  sandbox/         — Shell command sandboxing (local/Docker)
  skills/          — Skill store and telemetry
  plugins/         — Plugin loader
public/            — Frontend assets (React UI)
tests/             — Vitest test suite
```

## Auth

On first boot, a bearer token is generated at `~/.kiro/runtime/ares.token`. The browser needs this token to access `/api/*` endpoints. The UI handles this automatically via `/api/auth-handshake`.

## License

MIT
