// Phase U06 — dangerous-command classifier + per-run approval registry.
//
// The classifier inspects (toolName, args) and returns:
//   { risk: "low"|"medium"|"high",
//     reason: string,
//     allow: boolean,        // hard-deny when false (regardless of user)
//     requireConfirm: bool,  // pause + ask the user before dispatching
//   }
//
// Risk tiers (Hermes-aligned):
//   low    — read-only ops. Always allowed. requireConfirm=false.
//   medium — write/install/draft side effects. Allowed but pause for
//            user confirmation in the chat UI / compact panel.
//   high   — delete / prod / vendor-facing send. NEVER auto-allowed.
//            requireConfirm=true regardless of user policy. The user can
//            still approve interactively, but a high-risk call cannot
//            slip through silently.
//
// The registry lives in-memory inside server.js and is keyed by sessionId.
// One pending approval at a time per session — the agent loop blocks on it,
// so we never have two outstanding for the same run.
//
// Coexistence with lib/jobs/policy.js — that classifier gates job-handler
// tool calls (cron-driven, no human present). This one gates the live
// agent. Both can coexist; they don't share state. The classifier rules
// here are stricter (the agent has a human at the keyboard).

// Tool name patterns. The hub prefixes every MCP tool with `<server>__`
// so the patterns match the prefixed form.

const HIGH_RISK_PATTERNS = [
  // Phase U11 — proposed skill patches replace an existing recipe wholesale
  // (skill_save with overwrite=true). Treated high-risk so the U06 approval
  // gate forces a diff-confirmation step before the playbook is mutated.
  /^ares_skill_propose_patch$/,
  // Vendor-facing email/Slack send — explicit "post / send / reply_send".
  /^email-mcp__email_send/i,
  /^email-mcp__email_reply_send/i,
  /^email-mcp__email_send_reply/i,
  /^email-mcp__send_email/i,
  /^email-mcp__reply_email/i,
  /^chat-mcp__post_message/i,
  /^chat-mcp__post_block_message/i,
  /^chat-mcp__edit_message/i,
  /^chat-mcp__schedule_message/i,
  /^chat-mcp__schedule_block_message/i,
  // Mass deletes / destructive shell.
  /^shell-agent__shell_exec$/i,           // not always destructive — see arg sniffer below
  // SIM creates against unallowlisted CTIs (the live agent doesn't have a
  // CTI allowlist baked in; treat all SIM creates as high-risk).
  /SimAddComment/i,
  /TicketingWriteActions/i,
];

const MEDIUM_RISK_PATTERNS = [
  // Filesystem writes.
  /__fs_write$/i,
  /__fs_move$/i,
  /__fs_copy$/i,
  /__fs_delete$/i,
  /__fs_mkdir$/i,
  /__fs_chmod$/i,
  // Email DRAFT (still writes a side-effect under the user's mailbox,
  // but not visible to the recipient — medium, not high).
  /^email-mcp__email_draft/i,
  /^email-mcp__email_reply/i,
  // Slack draft / reaction add.
  /^chat-mcp__post_draft/i,
  /^chat-mcp__add_reaction/i,
  // Memory writes are persistent but local — medium.
  /^memory__memory_record/i,
  /^memory__memory_set_preference/i,
  // Skills writes.
  /^skills__skill_save/i,
  /^skills__skill_record_run/i,
  // COST_MetricB mutations.
  /^contra-cogs.*(?:Create|Modify|Delete)Agreement/i,
  /^example-integration.*(?:Create|Modify|Delete)Agreement/i,
  // Argo retail mutations.
  /^argoretailservice-mcp__(?:Create|Update|Delete|Cancel)/i,
  // Jobs / hub mutations.
  /^ares_(?:activate|deactivate)_mcp$/i,
  // Python / brew / npm install / pip install via shell.
];

// Shell-arg sniffer: bumps shell_exec from medium to high when the
// command line carries irreversible destructive patterns.
const SHELL_DESTRUCTIVE_REGEXES = [
  /\brm\s+-rf?\s+\/?[^/\s]/i,                  // rm -rf <path>
  /\bdd\s+if=.+of=\/dev\//i,                    // dd to a device
  /\bmkfs\b/i,                                  // mkfs.*
  /\b(?:shutdown|reboot|halt|poweroff)\b/i,
  /\bgit\s+push\s+--force\b/i,                  // force push
  /\bgit\s+reset\s+--hard\s+(?!HEAD~?\d*$)/i,   // reset --hard <ref> (not just HEAD~)
  /\bgit\s+clean\s+-f/i,
  />\/dev\/sd[a-z]/i,                           // writes to a raw disk
  /\bDROP\s+(?:TABLE|DATABASE|SCHEMA)/i,        // SQL drop
  /\bTRUNCATE\s+TABLE/i,
  /\bcurl\s+.+\|\s*(?:bash|sh|zsh)\b/i,         // pipe-to-shell
  /\bsudo\s+(?:rm|dd|chmod|chown)\b/i,
];

/**
 * Classify a tool call. Cheap, synchronous. Never throws.
 *
 * @param {string} toolName  — prefixed tool name as the hub sees it
 * @param {object} input     — raw args the agent intends to pass
 * @returns {{ risk: "low"|"medium"|"high", reason: string, allow: boolean, requireConfirm: boolean }}
 */
export function classify(toolName, input) {
  if (!toolName || typeof toolName !== "string") {
    return { risk: "low", reason: "no tool name", allow: true, requireConfirm: false };
  }

  // Shell escalation: shell_exec is medium by default; high when the
  // command looks irreversible.
  if (/^shell-agent__shell_exec$/i.test(toolName)) {
    const cmd = String(input?.command || "");
    for (const re of SHELL_DESTRUCTIVE_REGEXES) {
      if (re.test(cmd)) {
        return {
          risk: "high",
          reason: `shell command matches destructive pattern ${re}`,
          allow: true,
          requireConfirm: true,
        };
      }
    }
    return { risk: "medium", reason: "shell exec — review before running", allow: true, requireConfirm: false };
  }

  for (const re of HIGH_RISK_PATTERNS) {
    if (re.test(toolName)) {
      return {
        risk: "high",
        reason: `matches high-risk pattern ${re}`,
        allow: true,
        requireConfirm: true,
      };
    }
  }

  // B-25: default-deny for destructive verbs at the tool-name level.
  // Pre-fix only the explicit HIGH_RISK_PATTERNS list flagged risk;
  // future MCPs with `__delete_*`, `__drop_*`, `__truncate_*`,
  // `__destroy_*` shapes were not auto-flagged. Catch them here.
  if (/(?:^|__)(?:delete|destroy|drop|truncate|wipe|purge)_/i.test(toolName)) {
    return {
      risk: "high",
      reason: `tool name ${toolName} contains a destructive verb`,
      allow: true,
      requireConfirm: true,
    };
  }

  for (const re of MEDIUM_RISK_PATTERNS) {
    if (re.test(toolName)) {
      return {
        risk: "medium",
        reason: `matches medium-risk pattern ${re}`,
        allow: true,
        requireConfirm: false,
      };
    }
  }

  return { risk: "low", reason: "default (read-only / unknown)", allow: true, requireConfirm: false };
}

// ────────────────────────── per-run registry ──────────────────────────
//
// One pending approval per sessionId at a time. The agent loop pushes a
// pending entry, yields `approval_required`, and awaits the resolve()
// closure. The HTTP layer's POST /api/runs/:id/approve|deny calls
// resolve(verdict).

export class ApprovalRegistry {
  constructor() {
    this._pending = new Map();
  }

  /**
   * Enqueue a pending approval. Returns the id used by the HTTP endpoints.
   * The promise resolves with { decision: "approve"|"deny", reason? }.
   */
  enqueue({ sessionId, toolName, input, classification }) {
    if (!sessionId) throw new Error("approval enqueue: sessionId required");
    if (this._pending.has(sessionId)) {
      throw new Error(`approval already pending for session ${sessionId}`);
    }
    let resolveFn;
    const promise = new Promise((resolve) => { resolveFn = resolve; });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._pending.set(sessionId, {
      id,
      sessionId,
      toolName,
      input,
      classification,
      createdAt: Date.now(),
      resolve: resolveFn,
      promise,
    });
    return { id, promise };
  }

  /**
   * B-22: atomic supersede. Pre-fix server.js called cancel() then
   * enqueue() — a 2-step dance where the cancel resolved the prior
   * promise as deny, then the agent loop racing the cancel could
   * dispatch a deny path on a still-flight tool. supersede() does
   * both in one tick: drop the prior entry without resolving (caller
   * must already hold the new request), then enqueue.
   */
  supersede({ sessionId, toolName, input, classification }) {
    const prior = this._pending.get(sessionId);
    if (prior) {
      // Resolve the prior with a distinct reason so the caller can
      // distinguish supersede from a user-issued cancel.
      this._pending.delete(sessionId);
      prior.resolve({ decision: "deny", reason: "superseded by newer request" });
    }
    return this.enqueue({ sessionId, toolName, input, classification });
  }

  /**
   * Resolve the pending approval for a session.
   *
   * B-21: optional `expectedId` defends against stale-tab replay. If the
   * caller knows the registry-issued approval id (e.g. it came from
   * /api/runs/pending-approvals), it can pass it to assert that the
   * pending entry IS the one the user clicked. A mismatch returns
   * { ok: false, reason: "stale" } and does NOT resolve the new entry.
   *
   * Backwards-compatible: when expectedId is null/undefined, behaves
   * exactly as before (resolves whatever is pending) and returns a plain
   * boolean for the legacy callers.
   *
   * @param {string} sessionId
   * @param {"approve"|"deny"} decision
   * @param {string|null} reason
   * @param {{ expectedId?: string }} [opts]
   * @returns {boolean | { ok: boolean, reason?: string }}
   */
  resolve(sessionId, decision, reason = null, opts = {}) {
    const entry = this._pending.get(sessionId);
    const expectedId = opts.expectedId ?? null;
    if (!entry) {
      return expectedId === null ? false : { ok: false, reason: "no pending approval" };
    }
    if (expectedId !== null && entry.id !== expectedId) {
      // Stale click: the user's tab is showing a previous approval id, but
      // a different one is now pending. Refuse to resolve.
      return { ok: false, reason: "stale" };
    }
    this._pending.delete(sessionId);
    entry.resolve({ decision, reason });
    return expectedId === null ? true : { ok: true };
  }

  /** Snapshot of all currently-pending approvals (for /api/runs/pending-approvals). */
  list() {
    return [...this._pending.values()].map(({ resolve, promise, ...rest }) => rest);
  }

  /** Get the pending entry for a session without resolving. */
  get(sessionId) {
    const entry = this._pending.get(sessionId);
    if (!entry) return null;
    const { resolve, promise, ...rest } = entry;
    return rest;
  }

  /** Is anything pending for this session? */
  has(sessionId) {
    return this._pending.has(sessionId);
  }

  /** Drop without resolving — used on stop / abort cleanups. */
  cancel(sessionId, reason = "cancelled") {
    const entry = this._pending.get(sessionId);
    if (!entry) return false;
    this._pending.delete(sessionId);
    entry.resolve({ decision: "deny", reason });
    return true;
  }
}
