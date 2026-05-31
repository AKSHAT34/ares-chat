// Parallel agentic orchestrator with LIVE STREAMING.
// Each sub-agent streams events in real-time to the UI via a shared queue.
// The main generator yields events as they arrive from any sub-agent.
//
// Hardening notes (2025 audit):
//  - Every sub-agent IIFE is wrapped in try/finally so activeCount ALWAYS
//    decrements — even if bedrockFactory/agent.run throws synchronously.
//    Without this the orchestrator hangs forever on `waitForEvent()`.
//  - The final `done` event includes a SYNTHETIC assistant turn so the
//    server can persist the full parallel conversation to disk.
//  - Incremental `progress` events are emitted so the server can save
//    partial results when the client disconnects mid-stream.
//
// Q-pass-4-C — exposes a tiny pub/sub state API so the new "Tasks" right-
// rail panel can render the live subtask tree:
//   - getState() returns { tasks: [...], activeSessionId } — a snapshot
//   - subscribe(cb) → unsubscribe; cb invoked with { type, task } events
//
// Tasks are kept module-global because there is at most one active
// orchestrator run at a time per server, and the UI just wants the
// current view. We keep history bounded — the most-recent run replaces
// the previous one when a new "decomposing" status fires.

import { EventEmitter } from "node:events";
import { Agent } from "./agent.js";

const MAX_PARALLEL = 5;

// ─── Module-global live-state for the Tasks panel ────────────────────
//
// The shape returned to /api/orchestrator/state. Replaced wholesale
// when a new run begins; mutated in place as subtasks progress.
const _state = {
  tasks: [],          // Array<TaskEntry>
  activeSessionId: null,
};
const _stateEvents = new EventEmitter();
_stateEvents.setMaxListeners(50);

/** Public snapshot for `/api/orchestrator/state`. */
export function getOrchestratorState() {
  // Return a deep-ish copy so callers can serialize without mutation worry.
  return {
    tasks: _state.tasks.map((t) => ({ ...t })),
    activeSessionId: _state.activeSessionId,
  };
}

/** Subscribe to live updates for `/api/orchestrator/stream`. */
export function subscribeOrchestratorState(cb) {
  _stateEvents.on("update", cb);
  return () => { try { _stateEvents.off("update", cb); } catch {} };
}

function _emitUpdate(ev) {
  try { _stateEvents.emit("update", ev); } catch {}
}

function _resetTasks(sessionId) {
  _state.tasks = [];
  _state.activeSessionId = sessionId || null;
  _emitUpdate({ type: "reset", activeSessionId: _state.activeSessionId });
}

function _addTask(task) {
  _state.tasks = [..._state.tasks.filter((t) => t.id !== task.id), task];
  _emitUpdate({ type: "task_added", task });
}

function _updateTask(id, patch) {
  const idx = _state.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const prev = _state.tasks[idx];
  const next = { ...prev, ...patch };
  if (next.startedAt && next.finishedAt && !next.durationMs) {
    next.durationMs = Math.max(0, next.finishedAt - next.startedAt);
  }
  const arr = [..._state.tasks];
  arr[idx] = next;
  _state.tasks = arr;
  _emitUpdate({ type: "task_updated", task: next });
}

const DECOMPOSE_SYSTEM = `You are a task decomposition engine. Given a user request, break it into independent subtasks that can be executed in parallel by separate AI agents. Each agent has access to: shell commands, filesystem, memory/skills, and any configured MCP server.

Rules:
- Output ONLY valid JSON: { "subtasks": [ { "id": "t1", "title": "short title", "prompt": "full instruction for the sub-agent", "model": "sonnet|opus|haiku" } ] }
- Each subtask must be independently executable (no dependencies between them)
- If the task is inherently sequential (step B needs output of step A), put it as ONE subtask
- Max ${MAX_PARALLEL} subtasks
- Choose model per subtask: "haiku" for simple lookups, "sonnet" for tool-use, "opus" for complex reasoning
- If the task is simple enough for a single agent, return exactly 1 subtask`;

const SYNTHESIZE_SYSTEM = `You are a synthesis agent. Multiple sub-agents have completed their work in parallel. Combine their outputs into a single coherent response for the user. Be concise — don't repeat raw tool outputs, summarize the key findings.`;

export class Orchestrator {
  constructor({ bedrockFactory, hub, systemPrompt, approvalGate = null }) {
    this.bedrockFactory = bedrockFactory;
    this.hub = hub;
    this.systemPrompt = systemPrompt;
    // P2-11 — approval gate for sub-agents. Parallel-mode subagents used
    // to run with NO gate, so a dangerous tool (fs_delete, email send,
    // SIM file) executed unguarded. Thread the same gate the single-agent
    // path uses so parallel mode is held to the same safety bar.
    this.approvalGate = approvalGate;
  }

  /**
   * Run the parallel orchestration with LIVE streaming.
   * Events are yielded as they happen — not batched.
   *
   * @param {Array} messages - full Claude-shaped conversation including the new user turn
   * @param {string} userMessage - the text of the new user turn (for decomposition)
   */
  async *run(messages, userMessage, { abortSignal, sessionId } = {}) {
    const checkAbort = () => {
      if (abortSignal?.aborted) {
        const e = new Error("Aborted by client");
        e.name = "AbortError";
        throw e;
      }
    };

    // Q-pass-4-C — reset the live Tasks state so the UI panel renders
    // the new run's tree from scratch.
    _resetTasks(sessionId || null);

    yield { type: "orchestrator_status", status: "decomposing" };

    // Step 1: Decompose with Haiku
    const haiku = this.bedrockFactory("us.anthropic.claude-haiku-4-5-20251001-v1:0");
    let subtasks;
    try {
      const decomposeResult = await haiku.invoke({
        system: DECOMPOSE_SYSTEM,
        messages: [{ role: "user", content: [{ type: "text", text: userMessage }] }],
        max_tokens: 2048,
      }, { abortSignal });
      const rawText = decomposeResult?.content?.find((c) => c.type === "text")?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("decomposition returned no JSON");
      const parsed = JSON.parse(jsonMatch[0]);
      subtasks = (parsed.subtasks || []).slice(0, MAX_PARALLEL);
      if (!subtasks.length) throw new Error("no subtasks generated");
    } catch (err) {
      // Short-circuit on credential errors — no point falling back to
      // single-agent mode if Bedrock auth itself is broken.
      if (err?.isCredentialError) {
        yield {
          type: "error",
          error: err.message,
          kind: "credentials",
          reason: err.reason || "unknown",
          needsAuth: true,
        };
        return;
      }
      yield { type: "orchestrator_status", status: "fallback_single" };
      subtasks = [{ id: "t1", title: "Execute task", prompt: userMessage, model: "sonnet" }];
    }

    yield { type: "orchestrator_plan", subtasks: subtasks.map((s) => ({ id: s.id, title: s.title, model: s.model })) };
    yield { type: "orchestrator_status", status: "executing" };

    // Step 2: Execute subtasks with LIVE event streaming.
    // Shared queue bridges multiple async generators into one yield stream.
    const eventQueue = [];
    let queueResolve = null;
    const pushEvent = (ev) => {
      eventQueue.push(ev);
      if (queueResolve) { const r = queueResolve; queueResolve = null; r(); }
    };
    const waitForEvent = () => new Promise((r) => { queueResolve = r; });

    let activeCount = subtasks.length;
    const results = new Map();

    const modelMap = {
      haiku: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      sonnet: "us.anthropic.claude-sonnet-4-20250514",
      opus: "us.anthropic.claude-opus-4-8",
    };

    // Q-pass-4-C — seed the Tasks state with all subtasks as "pending"
    // so the Tasks panel renders the planned tree before execution starts.
    for (const subtask of subtasks) {
      _addTask({
        id: subtask.id,
        title: subtask.title,
        status: "pending",
        model: subtask.model,
        parentTaskId: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
      });
    }

    // Launch all sub-agents
    for (const subtask of subtasks) {
      pushEvent({ type: "subtask_start", id: subtask.id, title: subtask.title, model: subtask.model });
      _updateTask(subtask.id, { status: "running", startedAt: Date.now() });

      // Each sub-agent runs in its own async context. The IIFE MUST NOT
      // throw synchronously outside the try/finally — otherwise activeCount
      // never decrements and the orchestrator hangs forever.
      (async () => {
        const activatedMcps = new Set();
        let textBuffer = "";
        const toolCalls = [];
        try {
          const modelId = modelMap[subtask.model] || modelMap.sonnet;
          const bedrock = this.bedrockFactory(modelId);
          const agent = new Agent({ bedrock, hub: this.hub, systemPrompt: this.systemPrompt, approvalGate: this.approvalGate });

          // Replace the last user message with the subtask prompt.
          // Keep the original history context for shared memory/continuity.
          const agentMessages = [
            ...messages.slice(0, -1),
            { role: "user", content: [{ type: "text", text: subtask.prompt }] },
          ];

          for await (const ev of agent.run(agentMessages, { abortSignal })) {
            pushEvent({ type: "subtask_event", id: subtask.id, event: ev });

            if (ev.type === "text_delta") textBuffer += ev.text;
            if (ev.type === "tool_call") {
              toolCalls.push(ev.name);
              if (ev.name === "ares_activate_mcp" && ev.input?.name) {
                this.hub.pinMcp(ev.input.name);
                activatedMcps.add(ev.input.name);
              }
              if (ev.name === "ares_deactivate_mcp" && ev.input?.name) {
                this.hub.unpinMcp(ev.input.name);
                activatedMcps.delete(ev.input.name);
              }
            }
          }
        } catch (err) {
          // Emit error event so UI knows this sub-agent died. Preserve
          // credential-error metadata so the UI can show the auth-init CTA.
          const payload = err?.isCredentialError
            ? { type: "error", error: err.message, kind: "credentials", reason: err.reason || "unknown", needsAuth: true }
            : { type: "error", error: err.message };
          pushEvent({ type: "subtask_event", id: subtask.id, event: payload });
          _updateTask(subtask.id, { status: "failed", finishedAt: Date.now() });
        } finally {
          // CRITICAL: unpin any MCPs this agent still holds, record result,
          // and decrement activeCount — even on synchronous throw above.
          for (const mcpName of activatedMcps) {
            try { this.hub.unpinMcp(mcpName); } catch {}
          }
          results.set(subtask.id, { title: subtask.title, text: textBuffer, toolCalls });
          pushEvent({ type: "subtask_done", id: subtask.id, summary: textBuffer.slice(0, 500) });
          // Only flip pending/running → done on success. _updateTask is
          // idempotent on identical patches, but we want to preserve the
          // "failed" status from the catch block above.
          const cur = _state.tasks.find((t) => t.id === subtask.id);
          if (cur && cur.status !== "failed") {
            _updateTask(subtask.id, { status: "done", finishedAt: Date.now() });
          }
          activeCount--;
          if (activeCount === 0) pushEvent({ type: "_all_done" });
        }
      })();
    }

    // Yield events from the queue as they arrive
    let allDone = false;
    while (!allDone) {
      if (abortSignal?.aborted) {
        // Drain whatever's already queued (for on-disk stream log), then bail.
        while (eventQueue.length > 0) {
          const ev = eventQueue.shift();
          if (ev.type !== "_all_done") yield ev;
        }
        yield { type: "aborted", reason: "client-stop" };
        return;
      }
      while (eventQueue.length > 0) {
        const ev = eventQueue.shift();
        if (ev.type === "_all_done") { allDone = true; break; }
        yield ev;
      }
      if (allDone) break;
      if (activeCount === 0 && eventQueue.length === 0) { allDone = true; break; }
      await waitForEvent();
    }

    // Drain any remaining events
    while (eventQueue.length > 0) {
      const ev = eventQueue.shift();
      if (ev.type !== "_all_done") yield ev;
    }

    // Step 3: Synthesize into a final response. Accumulate the synthesized
    // text so we can persist it in the `done` event.
    let synthesizedText = "";

    if (subtasks.length > 1) {
      yield { type: "orchestrator_status", status: "synthesizing" };

      const summaries = [...results.values()].map((r) =>
        `## Subtask: ${r.title}\n${r.text || "(no text response)"}\n(Tools used: ${r.toolCalls.join(", ") || "none"})`
      ).join("\n\n---\n\n");

      const opus = this.bedrockFactory("us.anthropic.claude-opus-4-8");
      try {
        const stream = opus.stream({
          system: SYNTHESIZE_SYSTEM,
          messages: [{
            role: "user",
            content: [{ type: "text", text: `Original request: ${userMessage}\n\n---\n\nSub-agent results:\n\n${summaries}\n\nPlease synthesize these into a single coherent response.` }],
          }],
          max_tokens: 4096,
        }, { abortSignal });

        for await (const ev of stream) {
          checkAbort();
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            synthesizedText += ev.delta.text;
            yield { type: "text_delta", text: ev.delta.text };
          }
        }
      } catch (err) {
        if (err?.isCredentialError) {
          // Bail early — credentials are expired, synthesis can't recover.
          yield {
            type: "error",
            error: err.message,
            kind: "credentials",
            reason: err.reason || "unknown",
            needsAuth: true,
          };
          return;
        }
        const errText = `\n\n*Synthesis error: ${err.message}*`;
        synthesizedText += errText;
        yield { type: "text_delta", text: errText };
      }
    } else {
      // Single-subtask path: the sub-agent's text was streamed live via
      // subtask_event → we need to promote it so it renders as the main
      // assistant bubble AND gets persisted to disk.
      const only = [...results.values()][0];
      if (only && only.text) {
        synthesizedText = only.text;
      }
    }

    // Build a synthetic assistant turn so the server can persist it.
    // Also include a summary block with sub-agent outputs for future context.
    const subtaskSummary = [...results.values()]
      .map((r) => `- ${r.title}: ${(r.text || "").slice(0, 300).replace(/\s+/g, " ")}`)
      .join("\n");

    const finalAssistantText = synthesizedText ||
      `(Parallel run completed — ${results.size} sub-agent(s).)\n\n${subtaskSummary}`;

    const finalMessages = [
      ...messages,
      {
        role: "assistant",
        content: [{ type: "text", text: finalAssistantText }],
      },
    ];

    yield { type: "done", finalMessages };
  }
}
