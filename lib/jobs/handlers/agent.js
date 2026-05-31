// Phase U08 — generic agent-driven job handler.
//
// Each dynamic job is { prompt, model, mcps[], attachSkills, deliver:{kind,target} }.
// This handler:
//   1. Activates listed MCPs (already handled by the runner, but we
//      tolerate them being inactive).
//   2. Spawns a fresh Agent against the live hub + system prompt.
//   3. Auto-denies any medium/high-risk tool call (no human in the loop —
//      same guard as the gateway in U07c).
//   4. Streams text_delta, accumulates the synthesised reply.
//   5. Routes via deliver():
//        - "browser-toast" → just include in the SSE /api/jobs/events
//          stream so any browser tab can render a notification.
//        - "chat-mcp"     → chat-mcp__post_draft to deliver.target
//                            (channel id; treated as draft per U07c policy)
//        - "email-mcp" → email-mcp__email_reply_draft to
//                            deliver.target ({folder, conversationId} JSON
//                            string, or just folder for new drafts)
//
// The runner's recordRunFinish call captures summary, stats, and a
// log of major events.

import { Agent } from "../../agent.js";
import { classify as classifyApproval } from "../../approval.js";

const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per dynamic job

/**
 * @param ctx — JobContext from runner.js (jobId, runId, hub, bedrockFactory, log, callTool)
 * @param spec — { prompt, model, mcps, attachSkills, deliver, title }
 */
export async function runAgentJob(ctx, spec) {
  const log = (level, msg) => ctx.log?.(level, msg);
  log("info", `agent job "${spec.title || ctx.jobId}" — model=${spec.model || "sonnet"}, mcps=[${(spec.mcps || []).join(",")}]`);

  const modelMap = {
    haiku:  "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    sonnet: "us.anthropic.claude-sonnet-4-20250514",
    opus:   "us.anthropic.claude-opus-4-8",
  };
  const modelId = modelMap[spec.model] || spec.model || modelMap.sonnet;

  // Build the user message. If attachSkills is true, prefix with a hint
  // so the agent calls skill_search before doing anything else (matches
  // the human routing-ladder convention in system-prompt.js step 2).
  const userText = spec.attachSkills
    ? `[scheduled job: ${spec.title || ctx.jobId}]\n\nFollow the routing ladder: call skills__skill_search first if a recipe applies. Then complete the task below.\n\n${spec.prompt}`
    : `[scheduled job: ${spec.title || ctx.jobId}]\n\n${spec.prompt}`;
  const messages = [{ role: "user", content: [{ type: "text", text: userText }] }];

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), RUN_TIMEOUT_MS);

  const bedrock = ctx.bedrockFactory(modelId);
  const agent = new Agent({
    bedrock,
    hub: ctx.hub,
    systemPrompt: ctx._systemPrompt || "",
    // Auto-deny medium/high-risk tools: no human present to confirm.
    approvalGate: async (toolUse) => {
      const cls = classifyApproval(toolUse?.name, toolUse?.input || {});
      if (!cls.requireConfirm) return null;
      log("warn", `auto-denying ${cls.risk}-risk tool ${toolUse?.name}`);
      return { deny: true, reason: `cron auto-deny (${cls.risk})` };
    },
  });

  let reply = "";
  let toolCallCount = 0;
  let lastError = null;
  try {
    for await (const ev of agent.run(messages, { abortSignal: abort.signal })) {
      if (ev?.type === "text_delta" && typeof ev.text === "string") {
        reply += ev.text;
      } else if (ev?.type === "tool_call") {
        toolCallCount += 1;
      } else if (ev?.type === "error" && ev.error) {
        lastError = ev.error;
      }
    }
  } catch (e) {
    lastError = e.message;
  } finally {
    clearTimeout(timer);
  }
  reply = reply.trim();

  // Delivery.
  const deliver = spec.deliver || { kind: "browser-toast" };
  let delivered = { kind: deliver.kind, ok: false, reason: null, ref: null };
  try {
    if (!reply) {
      delivered = { ...delivered, ok: false, reason: "agent produced no reply" };
    } else if (deliver.kind === "browser-toast") {
      // No platform call — the runner emits a /api/jobs/events SSE
      // notification with the summary; the UI side renders the toast.
      delivered = { ...delivered, ok: true, ref: null };
    } else if (deliver.kind === "chat-mcp" && deliver.target) {
      const r = await ctx.callTool("chat-mcp__post_draft", {
        channel: deliver.target, text: reply.slice(0, 12000),
      }, { summary: `slack draft to ${deliver.target}` });
      delivered = { ...delivered, ok: !r?.isError, ref: extractRef(r), reason: r?.isError ? extractText(r) : null };
    } else if (deliver.kind === "email-mcp" && deliver.target) {
      // target may be "Folder" or "Folder|conversationId" pipe-delimited.
      // P1-6 — use email_reply with saveDraft:true (draft-only), not the
      // non-existent email_reply_draft tool.
      const [folder, conversationId] = String(deliver.target).split("|");
      const r = await ctx.callTool("email-mcp__email_reply", {
        itemId: conversationId || undefined,
        conversationId: conversationId || undefined,
        folder,
        body: reply,
        saveDraft: true,
        format: "html",
      }, { summary: `outlook draft to ${folder}` });
      delivered = { ...delivered, ok: !r?.isError, ref: extractRef(r), reason: r?.isError ? extractText(r) : null };
    } else {
      delivered = { ...delivered, ok: false, reason: `unknown deliver.kind=${deliver.kind} or missing target` };
    }
  } catch (e) {
    delivered = { ...delivered, ok: false, reason: e.message };
  }

  return {
    summary: lastError
      ? `Agent job errored: ${lastError.slice(0, 160)}`
      : `Agent job ${delivered.ok ? "delivered" : "completed (no delivery)"} — ${reply.length} chars, ${toolCallCount} tool calls`,
    stats: {
      replyChars: reply.length,
      toolCalls: toolCallCount,
      delivered,
      error: lastError,
    },
  };
}

function extractRef(res) {
  try {
    const text = (res?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join(" ");
    const m = text.match(/(?:draftId|messageId|ts)[\s"':]+([\w.-]+)/i);
    return m ? m[1] : null;
  } catch { return null; }
}

function extractText(res) {
  try {
    return (res?.content || []).map((b) => b?.text || "").join(" ").slice(0, 240);
  } catch { return ""; }
}
