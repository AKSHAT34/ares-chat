// `ares chat` — interactive TUI rendered via ink.
//
// Zero-build: this file is plain ES module JavaScript using
// React.createElement directly. No JSX, no transpiler. Node 22 imports
// ink + react native ESM.
//
// Surface:
//   - top status line: model · profile · workspace · MCP count
//   - scrollable transcript: user / assistant turns + inline tool-call cards
//   - composer: multiline editor, Enter to send, Shift+Enter for newline
//   - slash commands: /help /quit /reset /model <id> /history
//   - up/down history nav inside the composer
//
// In-process: spawns its own McpHub (Tier 1 only) + bedrock driver +
// Agent. No HTTP. The CLI is its own session that doesn't share
// transcripts with the browser ones at sessions/<uuid>.json.

import path from "node:path";
import os from "node:os";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { render, Box, Text, useApp, useInput, useStdout } from "ink";
import { McpHub } from "../mcp-client.js";
import { Agent } from "../agent.js";
import { BedrockClaude } from "../llm/bedrock-driver.js";
import { buildSystemPrompt } from "../system-prompt.js";
import { MODELS, getModel } from "../llm/model-registry.js";
import { cacheStatus } from "../llm/prompt-cache.js";

const e = React.createElement;

// ──────────────────────────── helpers ────────────────────────────

function shortenToolName(name) {
  return (name || "").replace(/^[a-z0-9-]+__/, "");
}

function defaultModelId() {
  return process.env.ARES_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514";
}

function defaultWorkspace() {
  return process.env.ARES_WORKSPACE || path.join(os.homedir(), "Documents", "Cline");
}

// ──────────────────────────── App ────────────────────────────

function App({ initialModelId }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const cols = stdout?.columns || 80;

  // ─── boot state ───
  const [boot, setBoot] = useState({ stage: "loading", message: "Initialising…" });
  const hubRef = useRef(null);
  const agentRef = useRef(null);
  const bedrockRef = useRef(null);
  const systemPromptRef = useRef("");

  // ─── transcript ───
  // turns: [{ role: "user"|"assistant", text, toolCalls: [{name, input, output, isError, status}] }]
  const [turns, setTurns] = useState([]);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const [streaming, setStreaming] = useState(false);
  const messagesRef = useRef([]); // raw Anthropic-shaped transcript for the agent

  // ─── composer ───
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [modelId, setModelId] = useState(initialModelId || defaultModelId());

  // Boot pipeline.
  useEffect(() => {
    (async () => {
      try {
        setBoot({ stage: "loading", message: "Spawning Tier 1 MCPs…" });
        const workspace = defaultWorkspace();
        const mcpJsonPath = path.join(workspace, ".kiro", "settings", "mcp.json");
        const hub = new McpHub({ mcpJsonPath, log: () => {} });
        await hub.start();
        hubRef.current = hub;

        setBoot({ stage: "loading", message: "Building system prompt…" });
        const sys = await buildSystemPrompt({
          workspaceRoot: workspace,
          mcpCatalog: hub.getCatalogForPrompt(),
          log: () => {},
        });
        systemPromptRef.current = sys;

        setBoot({ stage: "loading", message: "Connecting to Bedrock…" });
        const bedrock = new BedrockClaude({
          modelId,
          region: "us-west-2",
          profile: process.env.AWS_PROFILE,
        });
        bedrockRef.current = bedrock;
        agentRef.current = new Agent({ bedrock, hub, systemPrompt: sys, platform: "cli" });
        setBoot({ stage: "ready", message: "" });
      } catch (err) {
        setBoot({ stage: "error", message: err.message });
      }
    })();
  }, []);

  // Recreate the agent when the model id changes.
  useEffect(() => {
    if (boot.stage !== "ready" || !hubRef.current) return;
    const bedrock = new BedrockClaude({
      modelId,
      region: "us-west-2",
      profile: process.env.AWS_PROFILE,
    });
    bedrockRef.current = bedrock;
    agentRef.current = new Agent({
      bedrock,
      hub: hubRef.current,
      systemPrompt: systemPromptRef.current,
      platform: "cli",
    });
  }, [modelId]);

  const appendTurn = useCallback((turn) => {
    setTurns((prev) => [...prev, turn]);
  }, []);

  const updateLastTurn = useCallback((updater) => {
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const out = [...prev];
      out[out.length - 1] = updater(out[out.length - 1]);
      return out;
    });
  }, []);

  // Slash commands.
  const handleSlashCommand = useCallback((cmd) => {
    const [head, ...rest] = cmd.slice(1).trim().split(/\s+/);
    switch (head) {
      case "quit":
      case "exit":
      case "q":
        exit();
        return true;
      case "help":
        appendTurn({
          role: "assistant",
          text: "Slash commands:\n  /help         show this\n  /quit         exit (Ctrl+C also works)\n  /reset        clear transcript\n  /model <id>   switch Bedrock model\n  /models       list available models\n  /history      show recent prompts\n  /tools        list active MCPs",
          toolCalls: [],
        });
        return true;
      case "reset":
        setTurns([]);
        messagesRef.current = [];
        return true;
      case "models": {
        const lines = ["Available models:"];
        for (const m of MODELS) {
          if (m.id === "auto") continue;
          lines.push(`  ${m.id === modelId ? "→" : " "} ${m.icon} ${m.name.padEnd(12)} ${m.id}`);
        }
        appendTurn({ role: "assistant", text: lines.join("\n"), toolCalls: [] });
        return true;
      }
      case "model": {
        const target = rest.join(" ").trim();
        if (!target) {
          appendTurn({ role: "assistant", text: `Current model: ${modelId}. Use /models to list, /model <id> to switch.`, toolCalls: [] });
          return true;
        }
        // Allow short names ("haiku"/"sonnet"/"opus") or full ids.
        const match = MODELS.find((m) => m.id === target || m.tier === target.toLowerCase() || m.name.toLowerCase() === target.toLowerCase());
        if (!match || match.id === "auto") {
          appendTurn({ role: "assistant", text: `Unknown model "${target}". Try /models.`, toolCalls: [] });
          return true;
        }
        setModelId(match.id);
        appendTurn({ role: "assistant", text: `Switched to ${match.name} (${match.id}).`, toolCalls: [] });
        return true;
      }
      case "history": {
        const lines = history.length ? history.map((h, i) => `  ${i + 1}. ${h.slice(0, 80)}`) : ["(empty)"];
        appendTurn({ role: "assistant", text: ["Recent prompts:", ...lines].join("\n"), toolCalls: [] });
        return true;
      }
      case "tools": {
        const list = hubRef.current?.listServers() || [];
        const running = list.filter((s) => s.active);
        appendTurn({
          role: "assistant",
          text: `Active MCPs (${running.length}/${list.length}):\n` + running.map((s) => `  • ${s.name} (${s.toolCount} tools)`).join("\n"),
          toolCalls: [],
        });
        return true;
      }
      default:
        appendTurn({ role: "assistant", text: `Unknown command "/${head}". Try /help.`, toolCalls: [] });
        return true;
    }
  }, [exit, appendTurn, modelId, history]);

  // Send the current draft to the agent.
  const sendDraft = useCallback(async () => {
    if (streaming) return;
    const text = draft.trim();
    if (!text) return;
    if (text.startsWith("/")) {
      handleSlashCommand(text);
      setDraft("");
      return;
    }
    // History (newest first for up-arrow nav).
    setHistory((prev) => [text, ...prev].slice(0, 100));
    setHistIdx(-1);
    appendTurn({ role: "user", text, toolCalls: [] });
    setDraft("");

    const userMsg = { role: "user", content: [{ type: "text", text }] };
    messagesRef.current = [...messagesRef.current, userMsg];

    appendTurn({ role: "assistant", text: "", toolCalls: [] });
    setStreaming(true);

    let assistantBuffer = "";
    const toolMap = new Map(); // tool_use_id → idx in toolCalls
    try {
      for await (const ev of agentRef.current.run(messagesRef.current)) {
        switch (ev.type) {
          case "text_delta":
            assistantBuffer += ev.text || "";
            updateLastTurn((t) => ({ ...t, text: assistantBuffer }));
            break;
          case "tool_call":
            updateLastTurn((t) => {
              const tc = [...(t.toolCalls || [])];
              const idx = tc.length;
              tc.push({ name: ev.name, input: ev.input, status: "running", output: "" });
              toolMap.set(ev.id, idx);
              return { ...t, toolCalls: tc };
            });
            break;
          case "tool_result": {
            const idx = toolMap.get(ev.id);
            if (idx == null) break;
            updateLastTurn((t) => {
              const tc = [...(t.toolCalls || [])];
              tc[idx] = { ...tc[idx], status: ev.isError ? "error" : "done", output: ev.output };
              return { ...t, toolCalls: tc };
            });
            break;
          }
          case "done":
            if (Array.isArray(ev.finalMessages)) {
              messagesRef.current = ev.finalMessages;
            }
            break;
          case "error":
            updateLastTurn((t) => ({ ...t, text: (t.text || "") + `\n\n[error: ${ev.error}]`, error: true }));
            break;
          default:
            break;
        }
      }
    } catch (err) {
      updateLastTurn((t) => ({ ...t, text: (t.text || "") + `\n\n[error: ${err.message}]`, error: true }));
    } finally {
      setStreaming(false);
    }
  }, [draft, streaming, handleSlashCommand, appendTurn, updateLastTurn]);

  // Keyboard handling.
  useInput((input, key) => {
    if (boot.stage !== "ready") return;
    if (key.ctrl && (input === "c" || input === "d")) { exit(); return; }
    if (key.return) {
      if (key.shift) {
        setDraft((d) => d + "\n");
      } else if (!streaming) {
        sendDraft();
      }
      return;
    }
    if (key.upArrow) {
      if (history.length === 0) return;
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setDraft(history[next] || "");
      return;
    }
    if (key.downArrow) {
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setDraft(next === -1 ? "" : history[next] || "");
      return;
    }
    if (key.backspace || key.delete) {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setDraft((d) => d + input);
    }
  });

  // ───────────── render ─────────────
  if (boot.stage === "loading") {
    return e(Box, { flexDirection: "column", padding: 1 },
      e(Text, { color: "yellow" }, "✱ ", boot.message)
    );
  }
  if (boot.stage === "error") {
    return e(Box, { flexDirection: "column", padding: 1 },
      e(Text, { color: "red" }, "✗ Boot failed: ", boot.message)
    );
  }

  const headerCols = Math.max(40, cols - 4);
  const cache = cacheStatus();
  const headerLine =
    `Ares CLI · model=${getModel(modelId).name} · profile=${process.env.AWS_PROFILE || "(default)"} · cache=${cache.enabled ? "on" : "off"} · workspace=${defaultWorkspace().split("/").slice(-2).join("/")}`;

  return e(Box, { flexDirection: "column" },
    e(Box, { borderStyle: "single", paddingX: 1 },
      e(Text, { color: "cyan" }, headerLine.slice(0, headerCols))
    ),
    e(Box, { flexDirection: "column", paddingX: 1, paddingY: 0 },
      ...turns.map((t, i) => e(TurnView, { key: i, turn: t, cols: headerCols }))
    ),
    streaming
      ? e(Box, { paddingX: 1 }, e(Text, { color: "yellow" }, "✱ thinking…"))
      : null,
    e(Composer, { draft, streaming, cols: headerCols }),
  );
}

function TurnView({ turn, cols }) {
  const isUser = turn.role === "user";
  const colour = isUser ? "magenta" : (turn.error ? "red" : "white");
  const label = isUser ? "you" : "ares";
  return e(Box, { flexDirection: "column", marginBottom: 1 },
    e(Box, null, e(Text, { color: colour, bold: true }, `${label} `)),
    turn.text
      ? e(Box, { paddingLeft: 2 }, e(Text, { color: colour }, turn.text))
      : null,
    ...(turn.toolCalls || []).map((tc, j) => e(ToolCardView, { key: j, tc, cols }))
  );
}

function ToolCardView({ tc, cols }) {
  const colour = tc.status === "error" ? "red" : tc.status === "done" ? "green" : "yellow";
  const sym = tc.status === "error" ? "✗" : tc.status === "done" ? "✓" : "⟳";
  const inputPreview = (() => {
    try {
      const s = JSON.stringify(tc.input);
      return s.length > 100 ? s.slice(0, 97) + "..." : s;
    } catch { return ""; }
  })();
  return e(Box, { flexDirection: "column", paddingLeft: 2, marginTop: 0 },
    e(Box, null,
      e(Text, { color: colour }, `  ${sym} `),
      e(Text, { color: "cyan" }, shortenToolName(tc.name)),
      e(Text, { dimColor: true }, ` ${inputPreview}`),
    ),
    tc.output
      ? e(Box, { paddingLeft: 4 },
          e(Text, { dimColor: true }, String(tc.output).split("\n").slice(0, 4).join("\n").slice(0, cols * 3)))
      : null,
  );
}

function Composer({ draft, streaming, cols }) {
  const lines = (draft || "").split("\n");
  return e(Box, { flexDirection: "column", borderStyle: "single", borderColor: streaming ? "yellow" : "gray", paddingX: 1 },
    e(Box, null, e(Text, { dimColor: true }, "› ")),
    ...lines.map((ln, i) => e(Box, { key: i }, e(Text, null, ln))),
    e(Box, { marginTop: 0 },
      e(Text, { dimColor: true },
        streaming ? "(streaming — Ctrl+C to abort)" : "Enter to send · Shift+Enter for newline · /help for commands · ↑↓ history"
      )
    )
  );
}

// ──────────────────────────── entry ────────────────────────────

export async function runChatTui(opts = {}) {
  const initialModelId = opts.model || defaultModelId();
  const { waitUntilExit } = render(e(App, { initialModelId }));
  await waitUntilExit();
  return 0;
}
