// Phase U07c — gateway session model.
//
// Each inbound mention/email becomes a "gateway session": a synthetic
// chat conversation seeded from the inbound message text + metadata. The
// gateway runs the agent loop against it once and routes the result
// back through delivery.js (Slack draft / Outlook draft).
//
// Sessions are tracked in-memory only (no on-disk persistence). The
// canonical evidence of a gateway run is the platform-side draft (which
// the user reviews + sends manually).
//
// Gateway sessions are ISOLATED from interactive browser/CLI sessions.
// They don't appear in /api/sessions, don't share transcripts, and the
// approval registry uses a `gw:<id>` namespace so they can't be
// resolved through the normal /api/sessions/:id endpoints.

import crypto from "node:crypto";

export class GatewaySession {
  /**
   * @param {object} opts
   * @param {"slack"|"outlook"} opts.platform
   * @param {string} opts.target          — channel id or folder name
   * @param {string} opts.threadKey       — Slack ts / Outlook conversationId
   * @param {string} opts.fromUser        — who pinged us (for log + draft)
   * @param {string} opts.text            — inbound message body
   * @param {object} [opts.meta]          — anything else the platform wants to stash
   */
  constructor({ platform, target, threadKey, fromUser, text, meta = {} }) {
    this.id = `gw_${platform}_${crypto.randomUUID().slice(0, 12)}`;
    this.sessionId = `gw:${this.id}`; // namespace for ApprovalRegistry
    this.platform = platform;
    this.target = target;
    this.threadKey = threadKey;
    this.fromUser = fromUser || "(unknown)";
    this.text = text || "";
    this.meta = meta;
    this.createdAt = Date.now();
    this.status = "pending"; // "pending" | "running" | "completed" | "errored"
    this.draftRef = null;    // platform-specific identifier of the saved draft
    this.error = null;
  }

  asUserMessage() {
    // Surround the inbound text with metadata so the agent's reply is
    // contextual ("user X in channel Y said: …"). Stays under ~2K chars
    // even for long mentions; mailers truncate as needed.
    const header = `[gateway:${this.platform}] target=${this.target} from=${this.fromUser}`;
    const body = (this.text || "").trim().slice(0, 8000);
    return `${header}\n\n${body}`;
  }

  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      platform: this.platform,
      target: this.target,
      threadKey: this.threadKey,
      fromUser: this.fromUser,
      textPreview: (this.text || "").slice(0, 160),
      createdAt: this.createdAt,
      status: this.status,
      draftRef: this.draftRef,
      error: this.error,
    };
  }
}
