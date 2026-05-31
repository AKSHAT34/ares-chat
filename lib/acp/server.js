// Phase U07b — ACP (Agent Client Protocol) adapter.
//
// Pragmatic stdio JSON-RPC 2.0 server that lets Ares be driven from a
// Kiro/Zed/VS Code agent panel. Reads newline-delimited JSON from stdin,
// writes the same on stdout. Bidirectional — methods are requests
// (call → response), agent events are notifications (no response, just
// `params`).
//
// Methods (client → server):
//   initialize({ clientName, capabilities? })
//     → { agentName, agentVersion, capabilities: { sendMessage, cancel, approve } }
//   send_user_message({ sessionId, text, model? })
//     → ack { sessionId, runId } immediately. Streams notifications. Final
//       `done` notification carries the assembled assistant text.
//   cancel({ sessionId })
//     → { cancelled: bool }
//   approve_diff({ approvalId, decision, reason? })
//     → { resolved: bool }
//   list_tools()
//     → { tools: [{name, description}] }
//   shutdown()
//     → {}; server flushes and exits cleanly.
//
// Notifications (server → client):
//   text_delta       { sessionId, runId, text }
//   tool_call        { sessionId, runId, id, name, input }
//   tool_result      { sessionId, runId, id, output, isError }
//   approval_required{ sessionId, runId, approvalId, toolName, input, classification }
//   approval_resolved{ sessionId, runId, approvalId, decision, reason? }
//   done             { sessionId, runId, finalText }
//   error            { sessionId, runId, error }
//
// In-process: shares the same lib/* modules as the HTTP server. The ACP
// adapter is its own bedrockFactory + Agent + ApprovalRegistry — does NOT
// pollute the live ares-chat server's state.

import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import crypto from "node:crypto";
import { McpHub } from "../mcp-client.js";
import { Agent } from "../agent.js";
import { Orchestrator } from "../orchestrator.js";
import { BedrockClaude } from "../llm/bedrock-driver.js";
import { buildSystemPrompt } from "../system-prompt.js";
import { getModel } from "../llm/model-registry.js";
import { ApprovalRegistry, classify as classifyApproval } from "../approval.js";

const AGENT_NAME = "ares-chat";
const AGENT_VERSION = "1.0.0-acp";
const PROTOCOL = "ACP/1";

export class AcpServer {
  constructor({ stdin = process.stdin, stdout = process.stdout, log = (m) => process.stderr.write(m + "\n") } = {}) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.log = log;

    this.hub = null;
    this.systemPrompt = "";
    this.bedrockFactory = null;
    this.approvals = new ApprovalRegistry();

    // Per-session abort controllers + active runs.
    this.activeRuns = new Map(); // sessionId → AbortController
  }

  async start() {
    const workspace = process.env.ARES_WORKSPACE || path.join(os.homedir(), "Documents", "Cline");
    const mcpJsonPath = path.join(workspace, ".kiro", "settings", "mcp.json");

    this.hub = new McpHub({ mcpJsonPath, log: (m) => this.log(`[mcp] ${m}`) });
    await this.hub.start();
    // Wire orchestrator factory so ares_delegate_subagent (from U05) works
    // inside the ACP-driven loop too.
    this.hub.setOrchestratorFactory(() =>
      new Orchestrator({ bedrockFactory: this.bedrockFactory, hub: this.hub, systemPrompt: this.systemPrompt })
    );

    this.systemPrompt = await buildSystemPrompt({
      workspaceRoot: workspace,
      mcpCatalog: this.hub.getCatalogForPrompt(),
      log: (m) => this.log(`[prompt] ${m}`),
    });

    this.bedrockFactory = (modelId) => new BedrockClaude({
      modelId,
      region: process.env.AWS_REGION || "us-west-2",
      profile: process.env.AWS_PROFILE,
    });

    // ND-JSON reader — strict line-per-message contract.
    const rl = readline.createInterface({ input: this.stdin, crlfDelay: Infinity });
    rl.on("line", (line) => this._handleLine(line));
    rl.on("close", () => this._shutdown());

    this._send({ jsonrpc: "2.0", method: "ready", params: { protocol: PROTOCOL, agent: AGENT_NAME, version: AGENT_VERSION } });
  }

  _send(message) {
    try {
      this.stdout.write(JSON.stringify(message) + "\n");
    } catch (e) {
      this.log(`[acp] send failed: ${e.message}`);
    }
  }

  _notify(method, params) {
    this._send({ jsonrpc: "2.0", method, params });
  }

  _respond(id, result) {
    this._send({ jsonrpc: "2.0", id, result });
  }

  _respondError(id, code, message, data) {
    this._send({ jsonrpc: "2.0", id, error: { code, message, data } });
  }

  async _handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (e) {
      this._respondError(null, -32700, `Parse error: ${e.message}`);
      return;
    }
    if (!msg || msg.jsonrpc !== "2.0") {
      this._respondError(msg?.id ?? null, -32600, "Invalid Request: missing jsonrpc=2.0");
      return;
    }
    if (typeof msg.method !== "string") {
      // Treat as a response to a server-initiated request — we don't issue
      // any, so log and drop.
      this.log(`[acp] unexpected non-method message: ${trimmed.slice(0, 200)}`);
      return;
    }
    try {
      await this._dispatch(msg);
    } catch (e) {
      this._respondError(msg.id ?? null, -32603, `Internal error: ${e.message}`);
    }
  }

  async _dispatch(msg) {
    const { id, method, params = {} } = msg;
    switch (method) {
      case "initialize":
        return this._respond(id, {
          agentName: AGENT_NAME,
          agentVersion: AGENT_VERSION,
          protocol: PROTOCOL,
          capabilities: {
            sendMessage: true,
            cancel: true,
            approve: true,
            listTools: true,
          },
        });
      case "list_tools": {
        const tools = (this.hub?.getClaudeTools() || []).map((t) => ({
          name: t.name,
          description: t.description?.slice(0, 200) || "",
        }));
        return this._respond(id, { tools });
      }
      case "send_user_message":
        return this._handleSendMessage(id, params);
      case "cancel":
        return this._handleCancel(id, params);
      case "approve_diff":
        return this._handleApprove(id, params);
      case "shutdown":
        this._respond(id, {});
        await this._shutdown();
        return;
      default:
        return this._respondError(id, -32601, `Method not found: ${method}`);
    }
  }

  async _handleSendMessage(id, params) {
    const text = (params?.text || "").trim();
    if (!text) return this._respondError(id, -32602, "Invalid params: text is required");
    const sessionId = params?.sessionId || crypto.randomUUID();
    const modelId = (() => {
      const m = params?.model || process.env.ARES_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514";
      // Allow tier shortcuts.
      if (m === "haiku") return getModel("us.anthropic.claude-haiku-4-5-20251001-v1:0").id;
      if (m === "sonnet") return getModel("us.anthropic.claude-sonnet-4-20250514").id;
      if (m === "opus") return getModel("us.anthropic.claude-opus-4-8").id;
      return m;
    })();
    const runId = crypto.randomUUID();

    // Cancel any prior in-flight run for this session.
    if (this.activeRuns.has(sessionId)) {
      try { this.activeRuns.get(sessionId).abort(); } catch {}
    }
    const abort = new AbortController();
    this.activeRuns.set(sessionId, abort);

    // Ack immediately so the client can render its own pending state.
    this._respond(id, { sessionId, runId });

    const bedrock = this.bedrockFactory(modelId);
    const approvalGate = async (toolUse) => {
      const classification = classifyApproval(toolUse?.name, toolUse?.input || {});
      if (!classification.requireConfirm) return null;
      if (this.approvals.has(sessionId)) this.approvals.cancel(sessionId, "superseded");
      const { id: approvalId, promise } = this.approvals.enqueue({
        sessionId, toolName: toolUse.name, input: toolUse.input, classification,
      });
      this._notify("approval_required", {
        sessionId, runId, approvalId, toolUseId: toolUse.id,
        toolName: toolUse.name, input: toolUse.input, classification,
      });
      const verdict = await promise;
      this._notify("approval_resolved", {
        sessionId, runId, approvalId, toolUseId: toolUse.id,
        decision: verdict.decision, reason: verdict.reason || null,
      });
      if (verdict.decision !== "approve") {
        return { deny: true, reason: verdict.reason };
      }
      return null;
    };
    const agent = new Agent({
      bedrock,
      hub: this.hub,
      systemPrompt: this.systemPrompt,
      approvalGate,
    });
    const messages = [{ role: "user", content: [{ type: "text", text }] }];

    let assistantBuf = "";
    try {
      for await (const ev of agent.run(messages, { abortSignal: abort.signal })) {
        switch (ev.type) {
          case "text_delta":
            assistantBuf += ev.text || "";
            this._notify("text_delta", { sessionId, runId, text: ev.text });
            break;
          case "tool_call":
            this._notify("tool_call", { sessionId, runId, id: ev.id, name: ev.name, input: ev.input });
            break;
          case "tool_result":
            this._notify("tool_result", { sessionId, runId, id: ev.id, name: ev.name, output: ev.output, isError: ev.isError });
            break;
          case "error":
            this._notify("error", { sessionId, runId, error: ev.error });
            break;
          case "done":
            this._notify("done", { sessionId, runId, finalText: assistantBuf });
            break;
          default:
            break;
        }
      }
    } catch (e) {
      this._notify("error", { sessionId, runId, error: e.message });
    } finally {
      // Drop the controller — the run is over.
      if (this.activeRuns.get(sessionId) === abort) this.activeRuns.delete(sessionId);
    }
  }

  _handleCancel(id, params) {
    const sessionId = params?.sessionId;
    if (!sessionId) return this._respondError(id, -32602, "Invalid params: sessionId required");
    const ctrl = this.activeRuns.get(sessionId);
    let cancelled = false;
    if (ctrl) {
      try { ctrl.abort(); cancelled = true; } catch {}
    }
    this.approvals.cancel(sessionId, "client cancelled");
    return this._respond(id, { cancelled });
  }

  _handleApprove(id, params) {
    const decision = (params?.decision || "approve").toLowerCase();
    const reason = params?.reason || null;
    // The ACP spec calls this approve_diff but the same path covers tool-call
    // approvals here. We accept either { approvalId } or { sessionId } as
    // the routing key.
    if (params?.approvalId) {
      // Find the session that owns this approvalId.
      const all = this.approvals.list();
      const owner = all.find((a) => a.id === params.approvalId);
      if (!owner) return this._respond(id, { resolved: false, reason: "no pending approval with that id" });
      const ok = this.approvals.resolve(owner.sessionId, decision, reason);
      return this._respond(id, { resolved: ok, decision });
    }
    if (params?.sessionId) {
      const ok = this.approvals.resolve(params.sessionId, decision, reason);
      return this._respond(id, { resolved: ok, decision });
    }
    return this._respondError(id, -32602, "Invalid params: approvalId or sessionId required");
  }

  async _shutdown() {
    for (const ctrl of this.activeRuns.values()) {
      try { ctrl.abort(); } catch {}
    }
    this.activeRuns.clear();
    // Best-effort hub close — the existing hub doesn't expose a `close`
    // method (existing TODO from the launchd shutdown path). Just exit.
    setImmediate(() => process.exit(0));
  }
}

/** Convenience entry point used by `bin/ares.js acp`. */
export async function runAcpServer() {
  const server = new AcpServer();
  await server.start();
  // Keep the event loop alive — readline + stdin already do this, but
  // the "ready" notification must hit the wire before _shutdown().
  return new Promise(() => {});
}
