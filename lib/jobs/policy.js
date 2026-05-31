// Auto-action policy. Decides for every tool call whether the handler
// is allowed to commit it autonomously, or whether it must be held as
// a draft / escalated to the user.
//
// Example rules:
//  - Ticketing: auto-comment, auto-resolve against pre-approved categories.
//  - Email: ALWAYS draft, NEVER send. Full thread quoted in draft.
//  - Chat: SAFE_MODE — draft only.
//
// Verdicts: "auto_committed" | "draft_for_user" | "held_for_review" | "blocked"

const EMAIL_SEND_TOOLS = new Set([
  "email-mcp__email_send",
  "email-mcp__email_reply_send",
  "email-mcp__email_send_reply",
  "email-mcp__send_email",
  "email-mcp__reply_email",
]);

const CHAT_POST_TOOLS = new Set([
  "chat-mcp__post_message",
  "chat-mcp__post_block_message",
  "chat-mcp__edit_message",
  "chat-mcp__schedule_message",
  "chat-mcp__post_draft",
]);

const TICKET_WRITE_TOOLS = new Set([
  "ticket-mcp__add_comment",
  "ticket-mcp__write_action",
  "ticket-mcp__resolve",
  "ticket-mcp__create",
]);

// Pre-approved categories the ticket handler is allowed to auto-create against.
// Edit via /api/jobs/policy → POST { allowedCategories: [...] }.
const DEFAULT_ALLOWED_CATEGORIES = [
  // examples — confirm before going live:
  // { category: "Support", type: "Outreach", item: "Follow-up" },
];

export const DEFAULT_POLICY = {
  // Ticketing
  ticketAutoComment: true,
  ticketAutoResolve: true,
  ticketAutoCreate: true,
  ticketConfidenceThreshold: 0.85,
  ticketAllowedCategories: DEFAULT_ALLOWED_CATEGORIES,
  // Email
  emailAllowSend: false,        // hard NO
  emailAllowDraft: true,
  emailFullThreadQuote: true,
  // Chat
  chatAllowPost: false,
  chatSafeMode: true,
  // Misc
  filesystemCacheRoots: [".kiro/cache"],
};

let activePolicy = { ...DEFAULT_POLICY };

export function getPolicy() {
  return { ...activePolicy };
}

export function updatePolicy(patch) {
  activePolicy = { ...activePolicy, ...patch };
  return getPolicy();
}

/**
 * Decide what to do with a tool call about to be made by a job handler.
 * Returns { verdict, reason, redirectTo? }.
 */
export function classifyToolCall({ toolName, args, jobId, confidence }) {
  const policy = getPolicy();

  if (EMAIL_SEND_TOOLS.has(toolName)) {
    return {
      verdict: "blocked",
      reason: "Email send is policy-blocked. Use email_draft instead.",
      redirectTo: toolName.replace(/send|reply_send/i, "draft"),
    };
  }

  if (CHAT_POST_TOOLS.has(toolName)) {
    if (!policy.chatAllowPost) {
      return {
        verdict: "blocked",
        reason: "Chat posting is in SAFE_MODE. Held as draft text in run log.",
      };
    }
  }

  if (TICKET_WRITE_TOOLS.has(toolName)) {
    const action = (args?.action || args?.operation || "").toLowerCase();
    const isComment = /comment/.test(action) || toolName.includes("add_comment");
    const isResolve = /resolve|close/.test(action);
    const isCreate = /create|file|open/.test(action);

    if (isComment && !policy.ticketAutoComment) {
      return { verdict: "draft_for_user", reason: "ticketAutoComment disabled" };
    }
    if (isResolve && !policy.ticketAutoResolve) {
      return { verdict: "draft_for_user", reason: "ticketAutoResolve disabled" };
    }
    if (isCreate) {
      if (!policy.ticketAutoCreate) {
        return { verdict: "draft_for_user", reason: "ticketAutoCreate disabled" };
      }
      const cat = {
        category: args?.category || args?.cti?.category,
        type: args?.type || args?.cti?.type,
        item: args?.item || args?.cti?.item,
      };
      if (!policy.ticketAllowedCategories.length) {
        return {
          verdict: "held_for_review",
          reason: "ticketAllowedCategories is empty — confirm list before auto-create",
        };
      }
      const allowed = policy.ticketAllowedCategories.some(
        (c) => c.category === cat.category && c.type === cat.type && c.item === cat.item
      );
      if (!allowed) {
        return {
          verdict: "held_for_review",
          reason: `Category ${cat.category}/${cat.type}/${cat.item} not on allowlist`,
        };
      }
    }

    if (typeof confidence === "number" && confidence < policy.ticketConfidenceThreshold) {
      return {
        verdict: "held_for_review",
        reason: `confidence ${confidence.toFixed(2)} < threshold ${policy.ticketConfidenceThreshold}`,
      };
    }
    return { verdict: "auto_committed", reason: "policy_allow" };
  }

  // Default: read-only operations are auto.
  return { verdict: "auto_committed", reason: "default_allow" };
}

export const TOOL_CLASSES = {
  EMAIL_SEND_TOOLS: [...EMAIL_SEND_TOOLS],
  CHAT_POST_TOOLS: [...CHAT_POST_TOOLS],
  TICKET_WRITE_TOOLS: [...TICKET_WRITE_TOOLS],
};
