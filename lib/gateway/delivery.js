// Phase U07c — outbound delivery routing.
//
// Given a completed GatewaySession + the agent's synthesised reply,
// stash the reply as a draft on the originating platform. Today we ONLY
// support `kind: "draft"` for both chat-mcp and email-mcp —
// posting / sending behaviour is gated behind explicit policy in
// lib/jobs/policy.js (and audit-log of every send).
//
// The platform-specific tool-call shape is intentionally conservative:
// - chat-mcp:        post_draft({ channel, text }) — no rich blocks
// - email-mcp:  email_reply_draft({ folder, conversationId, body, format: "html" })
//
// If a platform doesn't expose the expected tool, deliver returns
// { ok: false, reason } and the GatewaySession is marked errored. The
// inbound message is NOT retried — gateway runs are exactly-once.

export async function deliver({ session, replyText, hub, mode = "draft", log = console.log, abortSignal = null }) {
  if (!session || !replyText) {
    return { ok: false, reason: "missing session or replyText" };
  }
  if (abortSignal?.aborted) {
    return { ok: false, reason: "delivery aborted before dispatch" };
  }
  switch (session.platform) {
    case "slack":
      return deliverSlack({ session, replyText, hub, mode, log, abortSignal });
    case "outlook":
      return deliverOutlook({ session, replyText, hub, mode, log, abortSignal });
    default:
      return { ok: false, reason: `unknown platform ${session.platform}` };
  }
}

// B-43: race the actual MCP call against the abortSignal so a delivery
// hang does NOT hold the gateway poll lock forever. Pre-fix only the
// agent run got the signal; deliver() ran without one.
async function _abortableCall(hub, name, args, abortSignal) {
  if (!abortSignal) return hub.callTool(name, args);
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error("delivery aborted"), { name: "AbortError" }));
    };
    if (abortSignal.aborted) return onAbort();
    abortSignal.addEventListener("abort", onAbort, { once: true });
    hub.callTool(name, args).then(
      (r) => { if (!settled) { settled = true; abortSignal.removeEventListener("abort", onAbort); resolve(r); } },
      (e) => { if (!settled) { settled = true; abortSignal.removeEventListener("abort", onAbort); reject(e); } },
    );
  });
}

async function deliverSlack({ session, replyText, hub, mode, log, abortSignal }) {
  if (mode !== "draft") {
    log(`[delivery:slack] mode=${mode} not supported in U07c — falling back to draft`);
    mode = "draft";
  }
  // Make sure chat-mcp is up. Pin it for the call so concurrent gateway
  // runs don't evict it mid-write.
  try {
    const r = await hub.activate("chat-mcp");
    if (!r.active) return { ok: false, reason: `chat-mcp activate failed: ${r.error || "unknown"}` };
  } catch (e) {
    return { ok: false, reason: `chat-mcp activate threw: ${e.message}` };
  }
  hub.pinMcp("chat-mcp");
  try {
    const args = {
      channel: session.target,
      text: replyText.slice(0, 12000),
      thread_ts: session.threadKey || undefined,
    };
    const res = await _abortableCall(hub, "chat-mcp__post_draft", args, abortSignal);
    return { ok: !res?.isError, draftRef: extractRef(res), reason: res?.isError ? extractText(res) : null };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    try { hub.unpinMcp("chat-mcp"); } catch {}
  }
}

async function deliverOutlook({ session, replyText, hub, mode, log, abortSignal }) {
  if (mode !== "draft") {
    log(`[delivery:outlook] mode=${mode} not supported in U07c — falling back to draft`);
    mode = "draft";
  }
  try {
    const r = await hub.activate("email-mcp");
    if (!r.active) return { ok: false, reason: `email-mcp activate failed: ${r.error || "unknown"}` };
  } catch (e) {
    return { ok: false, reason: `email-mcp activate threw: ${e.message}` };
  }
  hub.pinMcp("email-mcp");
  try {
    // P1-6 — the tool is `email_reply` (with saveDraft:true), NOT the
    // non-existent `email_reply_draft`. saveDraft keeps it draft-only,
    // matching the user's email_send_policy (never auto-send).
    const args = {
      itemId: session.threadKey || session.meta?.messageId,
      conversationId: session.threadKey || session.meta?.messageId,
      // B-44: Slack truncates at 12000 chars; Outlook didn't. Add the
      // same slice for symmetry — a 100k-char reply otherwise lands as
      // a giant draft that the email client then rejects on send.
      body: replyText.slice(0, 12000),
      saveDraft: true,
      format: "html",
    };
    const res = await _abortableCall(hub, "email-mcp__email_reply", args, abortSignal);
    return { ok: !res?.isError, draftRef: extractRef(res), reason: res?.isError ? extractText(res) : null };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    try { hub.unpinMcp("email-mcp"); } catch {}
  }
}

function extractRef(res) {
  // MCP results come back as { content: [{type:"text", text:"..."}] } —
  // grab the first JSON-looking line if present.
  try {
    const blocks = res?.content || [];
    for (const b of blocks) {
      if (typeof b?.text !== "string") continue;
      const m = b.text.match(/(?:draftId|messageId|ts)[\s"':]+([\w.-]+)/i);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

function extractText(res) {
  try {
    return (res?.content || []).map((b) => b?.text || "").join(" ").slice(0, 240);
  } catch { return ""; }
}
