// Phase U07c — gateway manager.
//
// One process-wide GatewayManager. Owns the per-platform poll timers, runs
// the agent loop on each fresh inbound message, and routes the agent's
// reply through delivery.js back to the originating platform as a draft.
//
// Lifecycle:
//   const mgr = new GatewayManager({ hub, bedrockFactory, systemPrompt, log });
//   mgr.applyConfig(readConfig());   // wires timers per platform
//   mgr.start();                      // first poll on each platform
//   mgr.stop();                       // clears timers
//
// Inbound runs are bounded:
//   - one in-flight run per platform at a time (queue otherwise)
//   - max 3 inbound messages per poll batch (older ones wait for next tick)
//   - run timeout 90s — beyond that the run is aborted and marked errored

import { GatewaySession } from "./session.js";
import { deliver } from "./delivery.js";
import {
  pollForMentions,
  markDelivered as slackMarkDelivered,
  markFailed as slackMarkFailed,
  _resetSeenForTests as resetSlackSeen,
} from "./platforms/slack.js";
import {
  pollForMail,
  markDelivered as outlookMarkDelivered,
  markFailed as outlookMarkFailed,
  _resetSeenForTests as resetOutlookSeen,
} from "./platforms/outlook.js";

// B-42: dispatch marks delivered/failed back to the platform-specific
// SEEN/IN_FLIGHT sets. Keyed by `seed.platform`.
const _PLATFORM_MARK = {
  slack:   { delivered: slackMarkDelivered,   failed: slackMarkFailed },
  outlook: { delivered: outlookMarkDelivered, failed: outlookMarkFailed },
};
function _markDelivered(seed) {
  if (!seed?.key) return;
  _PLATFORM_MARK[seed.platform]?.delivered?.(seed.key);
}
function _markFailed(seed) {
  if (!seed?.key) return;
  _PLATFORM_MARK[seed.platform]?.failed?.(seed.key);
}
import { Agent } from "../agent.js";
import { ApprovalRegistry } from "../approval.js";
import { defaultConfig } from "./config.js";

const RUN_TIMEOUT_MS = 90_000;
const MAX_PER_BATCH = 3;

export class GatewayManager {
  constructor({ hub, bedrockFactory, systemPrompt, log = console.log }) {
    this.hub = hub;
    this.bedrockFactory = bedrockFactory;
    this.systemPrompt = systemPrompt;
    this.log = log;
    this.config = defaultConfig();
    this.approvals = new ApprovalRegistry();
    this._timers = { slack: null, outlook: null };
    this._inFlight = { slack: false, outlook: false };
    this._stats = {
      slack:   { polls: 0, processed: 0, failed: 0, lastDeliveryAt: null },
      outlook: { polls: 0, processed: 0, failed: 0, lastDeliveryAt: null },
    };
    this._sessions = []; // last 50 GatewaySessions for /api/gateway/sessions
    this._started = false;
  }

  applyConfig(config) {
    this.config = config || defaultConfig();
    if (this._started) {
      this.stop();
      this.start();
    }
  }

  start() {
    if (this._started) return;
    this._started = true;
    if (!this.config.enabled) {
      this.log("[gateway] master switch is off — not starting any platform");
      return;
    }
    if (this.config.platforms?.slack?.enabled) {
      this._scheduleSlack();
      this.log("[gateway] slack platform started");
    }
    if (this.config.platforms?.outlook?.enabled) {
      this._scheduleOutlook();
      this.log("[gateway] outlook platform started");
    }
  }

  stop() {
    this._started = false;
    for (const k of ["slack", "outlook"]) {
      if (this._timers[k]) clearTimeout(this._timers[k]);
      this._timers[k] = null;
    }
  }

  _scheduleSlack() {
    const cfg = this.config.platforms?.slack;
    if (!cfg?.enabled) return;
    const tick = async () => {
      if (!this._started || !this.config.platforms?.slack?.enabled) return;
      this._stats.slack.polls += 1;
      try { await this._pollSlackOnce(); } catch (e) { this.log(`[gateway:slack] tick failed: ${e.message}`); }
      const ms = Math.max(15_000, this.config.platforms?.slack?.pollMs || 60_000);
      this._timers.slack = setTimeout(tick, ms);
    };
    this._timers.slack = setTimeout(tick, 2000);
  }

  _scheduleOutlook() {
    const cfg = this.config.platforms?.outlook;
    if (!cfg?.enabled) return;
    const tick = async () => {
      if (!this._started || !this.config.platforms?.outlook?.enabled) return;
      this._stats.outlook.polls += 1;
      try { await this._pollOutlookOnce(); } catch (e) { this.log(`[gateway:outlook] tick failed: ${e.message}`); }
      const ms = Math.max(30_000, this.config.platforms?.outlook?.pollMs || 90_000);
      this._timers.outlook = setTimeout(tick, ms);
    };
    this._timers.outlook = setTimeout(tick, 4000);
  }

  /**
   * Manual refresh — triggers an immediate Slack + Outlook poll without
   * waiting for the scheduled interval. Used by the Activity Feed
   * "Refresh" button. Returns counts of items found per platform.
   */
  async pollNow() {
    const result = { slack: 0, outlook: 0, errors: [] };
    if (this.config.platforms?.slack?.enabled && !this._inFlight.slack) {
      try {
        await this._pollSlackOnce();
        result.slack = this._stats.slack.processed;
      } catch (e) {
        result.errors.push(`slack: ${e.message}`);
      }
    }
    if (this.config.platforms?.outlook?.enabled && !this._inFlight.outlook) {
      try {
        await this._pollOutlookOnce();
        result.outlook = this._stats.outlook.processed;
      } catch (e) {
        result.errors.push(`outlook: ${e.message}`);
      }
    }
    return result;
  }

  async _pollSlackOnce() {
    if (this._inFlight.slack) return;
    this._inFlight.slack = true;
    try {
      const fresh = await pollForMentions({
        hub: this.hub,
        channels: this.config.platforms?.slack?.channels || [],
        log: this.log,
      });
      for (const seed of fresh.slice(0, MAX_PER_BATCH)) {
        await this._runOne(seed);
      }
    } finally {
      this._inFlight.slack = false;
    }
  }

  async _pollOutlookOnce() {
    if (this._inFlight.outlook) return;
    this._inFlight.outlook = true;
    try {
      const fresh = await pollForMail({
        hub: this.hub,
        folders: this.config.platforms?.outlook?.folders || [],
        log: this.log,
      });
      for (const seed of fresh.slice(0, MAX_PER_BATCH)) {
        await this._runOne(seed);
      }
    } finally {
      this._inFlight.outlook = false;
    }
  }

  /**
   * Run the agent against a GatewaySession seed and route the reply
   * through delivery. Used internally by the poll loops; exposed for
   * tests + a future "test-run a fake mention" UI button.
   */
  async _runOne(seed) {
    const session = new GatewaySession(seed);
    this._sessions.unshift(session);
    if (this._sessions.length > 50) this._sessions.pop();
    session.status = "running";

    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), RUN_TIMEOUT_MS);
    try {
      const modelId = this.config.model || "us.anthropic.claude-sonnet-4-20250514";
      const bedrock = this.bedrockFactory(modelId);
      const agent = new Agent({
        bedrock,
        hub: this.hub,
        systemPrompt: this.systemPrompt,
        // Gateway runs auto-deny medium/high risk tools — the user is not
        // present to confirm, and we don't want a polled mention to
        // trigger a destructive action without review.
        approvalGate: async (toolUse) => {
          // Lazy import to keep this module decoupled from approval.js
          // when the gateway isn't even running.
          const { classify } = await import("../approval.js");
          const cls = classify(toolUse?.name, toolUse?.input || {});
          if (!cls.requireConfirm) return null;
          this.log(`[gateway] auto-denying ${cls.risk}-risk tool ${toolUse?.name} for ${session.id}`);
          return { deny: true, reason: `gateway auto-deny (${cls.risk})` };
        },
      });
      const messages = [{ role: "user", content: [{ type: "text", text: session.asUserMessage() }] }];
      let reply = "";
      for await (const ev of agent.run(messages, { abortSignal: abort.signal })) {
        if (ev?.type === "text_delta" && typeof ev.text === "string") reply += ev.text;
        else if (ev?.type === "error" && ev.error) session.error = ev.error;
      }
      reply = reply.trim();
      if (!reply) {
        session.status = "errored";
        session.error = session.error || "agent produced no reply";
        this._stats[session.platform].failed += 1;
        return session;
      }
      const deliveryMode = this.config.delivery?.[session.platform] || "draft";
      const result = await deliver({
        session, replyText: reply, hub: this.hub, mode: deliveryMode, log: this.log,
        // B-43: hand the abort signal through so a hanging delivery
        // call doesn't hold the poll lock past RUN_TIMEOUT_MS.
        abortSignal: abort.signal,
      });
      if (result.ok) {
        session.status = "completed";
        session.draftRef = result.draftRef;
        this._stats[session.platform].processed += 1;
        this._stats[session.platform].lastDeliveryAt = Date.now();
        // B-42: promote from IN_FLIGHT → SEEN now that the message is
        // safely delivered. Subsequent polls won't re-emit.
        _markDelivered(seed);
      } else {
        session.status = "errored";
        session.error = result.reason || "delivery failed";
        this._stats[session.platform].failed += 1;
        // B-42: explicit delivery failure also counts as "we made the
        // dispatch decision, don't re-emit". The session+error is
        // logged for the user to retry manually if needed.
        _markDelivered(seed);
      }
    } catch (e) {
      session.status = "errored";
      session.error = e.message;
      this._stats[session.platform].failed += 1;
      // B-42: dispatch CRASH (vs explicit error) — clear IN_FLIGHT so
      // the next poll re-emits the message. Otherwise a thrown error
      // anywhere in the agent loop would silently drop a Slack mention
      // or vendor email forever.
      _markFailed(seed);
    } finally {
      clearTimeout(t);
    }
    return session;
  }

  // Public introspection used by /api/gateway/* endpoints + tray UI.
  status() {
    return {
      enabled: !!this.config.enabled,
      platforms: {
        slack: {
          enabled: !!this.config.platforms?.slack?.enabled,
          channels: this.config.platforms?.slack?.channels || [],
          pollMs: this.config.platforms?.slack?.pollMs,
          ...this._stats.slack,
        },
        outlook: {
          enabled: !!this.config.platforms?.outlook?.enabled,
          folders: this.config.platforms?.outlook?.folders || [],
          pollMs: this.config.platforms?.outlook?.pollMs,
          ...this._stats.outlook,
        },
      },
      delivery: this.config.delivery || {},
      model: this.config.model,
      recentSessions: this._sessions.slice(0, 20).map((s) => s.toJSON()),
    };
  }
}

/** Test hook — clears the per-process dedupe sets in both platform adapters. */
export function _resetGatewaySeenForTests() {
  resetSlackSeen();
  resetOutlookSeen();
}
