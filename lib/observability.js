// Phase 9 — observability primitives.
//
// Two surfaces:
//
//   1. Per-request id (req.reqId) attached to every /api/* request, plus
//      a [req=<id>] tag on the access-log line. Lets you correlate a
//      tail of [req] lines with a specific user action when more than
//      one request is in flight (e.g. tab open + chat stream).
//
//   2. /api/metrics endpoint exposing simple counters + histograms in
//      a Prometheus-compatible text format. This is enough for an
//      operator to see request rate, error rate, p95 latency without
//      pulling in a real Prometheus exporter.
//
// We intentionally keep dependencies zero — adding pino or prom-client
// is overkill for a single-user local server and breaks existing log
// scrapers. `console.log` stays the transport.

import crypto from "node:crypto";

// ────────────────────────── request ids ──────────────────────────

/**
 * Express middleware that stamps a short, sortable request id on every
 * /api/* request. Makes the access log greppable by id.
 */
export function requestIdMiddleware(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  // 8 hex chars is enough for human eyeballs at single-machine traffic.
  // The Date.now prefix keeps ids roughly sortable across boots.
  req.reqId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  res.setHeader("x-req-id", req.reqId);
  next();
}

// ────────────────────────── metrics ──────────────────────────

const counters = new Map(); // name → number
// D-9: histograms are now ring buffers, not arrays. Pre-fix `arr.shift()`
// to cap was O(n) — under sustained load that's 1024 element shifts per
// observation. Ring buffer is O(1) writes; reads materialise into a
// flat slice only when /api/metrics is scraped.
const histograms = new Map(); // name → { ring: number[], idx, full }

const HIST_MAX_SAMPLES = 1024;

export function incCounter(name, by = 1) {
  counters.set(name, (counters.get(name) || 0) + by);
}

export function observeHistogram(name, valueMs) {
  let h = histograms.get(name);
  if (!h) {
    h = { ring: new Array(HIST_MAX_SAMPLES), idx: 0, full: false };
    histograms.set(name, h);
  }
  h.ring[h.idx] = valueMs;
  h.idx = (h.idx + 1) % HIST_MAX_SAMPLES;
  if (h.idx === 0) h.full = true;
}

// Materialise the active samples for a histogram into a flat array.
// Returns a fresh array each call — callers can sort it without
// mutating the ring buffer.
function _materialiseHistogram(h) {
  if (!h) return [];
  if (!h.full) return h.ring.slice(0, h.idx);
  // Wrapped: idx is the oldest sample slot; concat tail+head.
  return h.ring.slice(h.idx).concat(h.ring.slice(0, h.idx));
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx];
}

/**
 * Express middleware that records request count + latency by route.
 * Routes are bucketed by the path template (e.g. /api/sessions/:id is
 * always counted as /api/sessions/:id, not the literal id) using a
 * coarse heuristic — collapse hex/uuid segments to ":id".
 */
export function metricsMiddleware(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  const t0 = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - t0;
    const route = bucketRoute(req.path);
    const okBucket = res.statusCode >= 500 ? "5xx"
                   : res.statusCode >= 400 ? "4xx"
                   : "2xx";
    incCounter(`http_requests_total{route="${route}",status="${okBucket}"}`);
    observeHistogram(`http_request_duration_ms{route="${route}"}`, ms);
  });
  next();
}

// D-11: bucketRoute hardening. Pre-fix only normalised UUIDs and pure-
// numeric segments. A request to `/api/sessions/notuuid-but-also-not-a-
// number/foo` would create a unique counter label per random `id` —
// combined with /api/metrics being public this was a small DoS surface
// (un-bounded counter cardinality). Now: any segment after `/api/<top>/`
// that isn't a known fixed sub-route gets collapsed to `:id`.
const _ROUTE_FIXED_SEGMENTS = new Set([
  // Anything we want to keep distinct in metrics goes here. Any other
  // segment in the slot after /api/<top>/ collapses to :id.
  "stream-tail", "stream-status", "approval", "approve", "deny", "stop",
  "resume-run", "resume-status", "feedback", "rename", "upload",
  "auto-title", "search", "index-stats", "pending-approvals", "events",
  "actions", "runs", "active",
]);
function bucketRoute(p) {
  // First pass: collapse UUIDs and pure-numerics.
  let out = p
    .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "/:id")
    .replace(/\/\d+/g, "/:n");
  // Second pass: collapse arbitrary :id-shaped segments (anything that
  // isn't one of our fixed sub-routes). Only applied to segments AFTER
  // /api/<top>/ — the top route name (e.g. "sessions", "jobs") stays.
  const m = out.match(/^(\/api\/[^/]+)(\/.*)?$/);
  if (m && m[2]) {
    const segs = m[2].split("/").filter(Boolean);
    const collapsed = segs.map((seg) => {
      if (seg.startsWith(":")) return seg;
      if (_ROUTE_FIXED_SEGMENTS.has(seg)) return seg;
      // Long opaque tokens (>16 chars) are almost certainly ids.
      if (seg.length > 16) return ":id";
      return seg;
    });
    out = m[1] + (collapsed.length ? "/" + collapsed.join("/") : "");
  }
  return out;
}

/**
 * Render the metrics in Prometheus text exposition format (v0.0.4).
 * Each counter and histogram is one line — we don't bother with
 * histogram buckets, just the percentiles, because nothing here is
 * actually scraping it. The format is human-readable enough.
 */
export function renderPromText() {
  const lines = [];
  lines.push("# HELP ares_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE ares_uptime_seconds gauge");
  lines.push(`ares_uptime_seconds ${Math.round(process.uptime())}`);

  lines.push("# HELP ares_memory_rss_bytes Resident set size of the Node process.");
  lines.push("# TYPE ares_memory_rss_bytes gauge");
  lines.push(`ares_memory_rss_bytes ${process.memoryUsage().rss}`);

  if (counters.size) {
    // Group counters by their bare name so each gets its own # TYPE line.
    // Anything tagged with `{...}` labels is left intact; bare names get
    // emitted as their own counter family.
    const buckets = new Map();
    for (const [k, v] of counters.entries()) {
      const baseName = k.includes("{") ? k.slice(0, k.indexOf("{")) : k;
      const arr = buckets.get(baseName) || [];
      arr.push([k, v]);
      buckets.set(baseName, arr);
    }
    for (const [base, entries] of buckets) {
      lines.push(`# TYPE ${base} counter`);
      for (const [k, v] of entries) lines.push(`${k} ${v}`);
    }
  }

  if (histograms.size) {
    lines.push("# TYPE http_request_duration_ms summary");
    for (const [k, h] of histograms.entries()) {
      const samples = _materialiseHistogram(h);
      const sorted = samples.slice().sort((a, b) => a - b);
      const p50 = quantile(sorted, 0.50);
      const p95 = quantile(sorted, 0.95);
      const p99 = quantile(sorted, 0.99);
      // Strip the histogram's `{route=…}` suffix and re-emit each
      // quantile as its own line per Prometheus convention.
      const labelMatch = k.match(/\{(.+)\}/);
      const labels = labelMatch ? labelMatch[1] : "";
      const sep = labels ? "," : "";
      lines.push(`http_request_duration_ms{${labels}${sep}quantile="0.5"} ${p50}`);
      lines.push(`http_request_duration_ms{${labels}${sep}quantile="0.95"} ${p95}`);
      lines.push(`http_request_duration_ms{${labels}${sep}quantile="0.99"} ${p99}`);
      lines.push(`http_request_duration_ms_sum{${labels}} ${samples.reduce((a, b) => a + b, 0)}`);
      lines.push(`http_request_duration_ms_count{${labels}} ${samples.length}`);
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * JSON snapshot for human consumption / dashboards. Same data as
 * renderPromText but easier to render in the UI.
 */
export function snapshotJson() {
  const histogramSummary = {};
  for (const [k, h] of histograms.entries()) {
    const samples = _materialiseHistogram(h);
    const sorted = samples.slice().sort((a, b) => a - b);
    histogramSummary[k] = {
      count: samples.length,
      p50: quantile(sorted, 0.50),
      p95: quantile(sorted, 0.95),
      p99: quantile(sorted, 0.99),
    };
  }
  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    counters: Object.fromEntries(counters),
    histograms: histogramSummary,
  };
}
