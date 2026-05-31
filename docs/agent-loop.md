# Agent loop


The agent runs a ReAct loop in `lib/agent.js`. One iteration:

1. Fire `preTurn` plugin hook (Phase U14).
2. Sanitise transcript (drop orphan `tool_result`, synthesise missing
   stubs — same invariants as `lib/session-integrity.js`).
3. Truncate large blocks (≤8 KB head + tail) via the active
   ContextEngine.
4. Run iterative compression if the transcript exceeds soft limits;
   pressure 0/1/2 strips progressively more "anchor" messages. Hard
   truncate is the last-resort fallback.
5. Pre-stream credential liveness check — refresh STS token if within
   2 min of expiry.
6. Inject `<recent_user_turns>` (always) + RAG `<relevant_history>` +
   memory brief (when budget allows).
7. Bedrock stream → accumulate `text_delta` / `tool_use` blocks.
8. For each `tool_use`:
   - Approval gate (`classify(toolName, input)`); high/medium-confirm
     calls block on user response. (Phase U06)
   - Sandbox interception for `shell-agent__shell_exec` when active
     backend ≠ local. (Phase U09)
   - Plugin `preToolCall` hook — can VETO. (Phase U14)
   - Hub dispatch.
   - Plugin `postToolCall` hook + skills telemetry.
9. Append `tool_result` blocks to working transcript. Loop.
10. On `stop_reason !== "tool_use"` → fire `postTurn` plugin hook →
    yield `done`.

## Stop conditions

- 500 iteration cap (raised from 200 for true long-run survival).
- Loop detector: identical (tool, input) called 3× in a row → bail.
- Stall detector: <50 chars text + 0 new tool names over 30 iter →
  nudge; +5 more without progress → bail.
- Token-budget hard limit (80K transcript): unconditional hard truncate
  before send.

## Model selection per turn

`/api/chat` accepts `model: "auto" | <id>`. `autoRoute(message,
attachments)` heuristically picks Haiku/Sonnet/Opus from prompt length,
verb signals, and attachment size — no LLM call needed (Phase U02).

## Parallel mode (Orchestrator)

`/api/chat` with `mode: "parallel"` decomposes via Haiku into ≤5
subtasks, runs each as a fresh Agent in parallel, synthesises with Opus.
See `lib/orchestrator.js`.

## Subagent delegation (mid-loop)

The agent can call `ares_delegate_subagent({prompt, model?, mcps?})`
to spawn a one-off sub-agent with its own context window. Useful when
intermediate tool output would balloon the parent's transcript.
(Phase U05)

See [tools.md](tools.md) for the meta-tool list, [bedrock.md](bedrock.md)
for the driver, [sessions.md](sessions.md) for transcript persistence.
