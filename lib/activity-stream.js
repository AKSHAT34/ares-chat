// Q-pass-4 (work-stream E) — unified activity-stream SSE.
//
// /api/activity/stream merges five sources into one SSE feed so the Q
// shell's right-rail "what's happening" panel can subscribe once instead
// of opening N parallel EventSource connections.
//
// Sources (each event tagged with a `source` discriminator):
//
//   "jobs"      — lifecycle events from lib/jobs/runner.js (run started,
//                 finished, failed). Wired by server.js subscribing to
//                 the jobRunner.events bus and forwarding them through
//                 emit({source: "jobs", …}).
//   "gateway"   — Slack/Outlook polled items + tool-error cards from
//                 lib/feed/index.js. server.js subscribes to feedHub.
//   "approvals" — pending / resolved approval-gate events. The approval
//                 hook in server.js calls emit({source: "approvals", …})
//                 directly when enqueueing or resolving entries.
//   "errors"    — agent-loop / Bedrock errors that the operator should
//                 see. agent.js / server.js call emit() with the error
//                 payload.
//   "memory"    — cross-session memory writes (auto-record + manual).
//                 server.js auto-record path emits after a successful
//                 memory_record so the operator can see what got promoted.
//
// Wire-format on the SSE channel:
//
//   data: {"source": "<src>", "ts": <ms>, "type": "<event-type>", "payload": {...}}\n\n
//
// `source` is always present; `ts` is set by emit() if the caller didn't
// supply one; `type` and `payload` are passed through verbatim. Unknown
// sources are still forwarded with `source` echoed back — we don't enforce
// a closed enum so callers can experiment without changing this file.

import { EventEmitter } from "node:events";

const VALID_SOURCES = new Set(["jobs", "gateway", "approvals", "errors", "memory"]);

const _bus = new EventEmitter();
_bus.setMaxListeners(50);

/**
 * Publish an event onto the activity stream.
 *
 * Required:
 *   - source: one of "jobs"|"gateway"|"approvals"|"errors"|"memory"
 *   - type:   short event-type string (e.g. "started", "approval_required")
 *
 * Optional:
 *   - ts:      millisecond timestamp; defaults to Date.now()
 *   - payload: arbitrary JSON-serialisable object; defaults to {}
 */
export function emitActivity(ev) {
  if (!ev || typeof ev !== "object") return;
  const source = String(ev.source || "");
  if (!source) return;
  const out = {
    source: VALID_SOURCES.has(source) ? source : source,
    ts: typeof ev.ts === "number" ? ev.ts : Date.now(),
    type: String(ev.type || "event"),
    payload: ev.payload && typeof ev.payload === "object" ? ev.payload : {},
  };
  _bus.emit("event", out);
}

/** Register a listener. Returns an unsubscribe function. */
export function subscribe(fn) {
  _bus.on("event", fn);
  return () => { try { _bus.off("event", fn); } catch {} };
}

/** Express SSE handler — subscribes to the bus, writes each event as a
 *  data: frame, cleans up on socket close. Mounted at /api/activity/stream
 *  by server.js (behind the standard authMiddleware). */
export function handleActivityStream(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  // Initial hello so the client knows the channel is open even before
  // any source emits.
  try { res.write(`data: ${JSON.stringify({ source: "control", ts: Date.now(), type: "hello", payload: {} })}\n\n`); } catch {}
  const off = subscribe((ev) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch {}
  });
  // Keep-alive comment every 25s so intermediaries don't time out.
  const keepalive = setInterval(() => {
    try { res.write(`: keepalive\n\n`); } catch {}
  }, 25_000);
  req.on("close", () => {
    clearInterval(keepalive);
    off();
  });
}

/**
 * Wire the bus to existing event sources. Called once at boot from
 * server.js after the jobRunner + feed modules are constructed. Safe to
 * call multiple times — listeners are tracked so we don't double-attach.
 */
let _wired = false;
export function wireActivityStream({ jobRunner, feedHub } = {}) {
  if (_wired) return;
  _wired = true;

  if (jobRunner?.events?.on) {
    jobRunner.events.on("event", (ev) => {
      emitActivity({ source: "jobs", type: ev?.type || "event", payload: ev || {} });
    });
  }
  if (feedHub?.on) {
    feedHub.on("item", (item) => {
      emitActivity({ source: "gateway", type: "item", payload: item || {} });
    });
    feedHub.on("read",    (id) => emitActivity({ source: "gateway", type: "read",    payload: { id } }));
    feedHub.on("dismiss", (id) => emitActivity({ source: "gateway", type: "dismiss", payload: { id } }));
  }
}

/** Test-only — clears the wired flag so vitest can re-mount listeners. */
export function _resetForTests() { _wired = false; _bus.removeAllListeners("event"); }
