// Phase 10 — unit tests for lib/observability.js.

import { describe, it, expect } from "vitest";
import {
  requestIdMiddleware,
  metricsMiddleware,
  incCounter,
  observeHistogram,
  renderPromText,
  snapshotJson,
} from "../lib/observability.js";

function fakeReqRes({ path = "/api/health", method = "GET" } = {}) {
  const req = { path, method, headers: {} };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    getHeader(k) { return this.headers[k]; },
    listeners: {},
    on(ev, cb) { (this.listeners[ev] = this.listeners[ev] || []).push(cb); },
    emit(ev) { (this.listeners[ev] || []).forEach((cb) => cb()); },
  };
  return { req, res };
}

describe("requestIdMiddleware", () => {
  it("stamps a req.reqId on /api/* requests", () => {
    const { req, res } = fakeReqRes({ path: "/api/sessions" });
    let called = false;
    requestIdMiddleware(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.reqId).toMatch(/^[a-z0-9]+-[a-f0-9]{6}$/);
    expect(res.headers["x-req-id"]).toBe(req.reqId);
  });

  it("skips non-/api requests", () => {
    const { req, res } = fakeReqRes({ path: "/index.html" });
    requestIdMiddleware(req, res, () => {});
    expect(req.reqId).toBeUndefined();
  });

  it("generates unique ids", () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const { req, res } = fakeReqRes({ path: "/api/x" });
      requestIdMiddleware(req, res, () => {});
      ids.add(req.reqId);
    }
    expect(ids.size).toBe(50);
  });
});

describe("metricsMiddleware + counters", () => {
  it("increments http_requests_total on finish", () => {
    const { req, res } = fakeReqRes({ path: "/api/foo" });
    metricsMiddleware(req, res, () => {});
    res.statusCode = 200;
    res.emit("finish");
    const txt = renderPromText();
    expect(txt).toMatch(/http_requests_total\{route="\/api\/foo",status="2xx"\}\s+\d+/);
  });

  it("buckets uuid path segments into :id", () => {
    const { req, res } = fakeReqRes({ path: "/api/sessions/12345678-1234-1234-1234-123456789012" });
    metricsMiddleware(req, res, () => {});
    res.statusCode = 404;
    res.emit("finish");
    const txt = renderPromText();
    expect(txt).toMatch(/route="\/api\/sessions\/:id"/);
    expect(txt).toMatch(/status="4xx"/);
  });

  it("records latency in the histogram", () => {
    const { req, res } = fakeReqRes({ path: "/api/bar" });
    metricsMiddleware(req, res, () => {});
    res.statusCode = 200;
    res.emit("finish");
    const snap = snapshotJson();
    const key = Object.keys(snap.histograms).find((k) => k.includes('"/api/bar"'));
    expect(key).toBeDefined();
    expect(snap.histograms[key].count).toBeGreaterThan(0);
  });
});

describe("incCounter / observeHistogram", () => {
  it("counters accumulate", () => {
    incCounter("audit_test_counter");
    incCounter("audit_test_counter");
    incCounter("audit_test_counter", 3);
    const snap = snapshotJson();
    expect(snap.counters.audit_test_counter).toBe(5);
  });

  it("observeHistogram records samples", () => {
    observeHistogram("audit_test_hist", 10);
    observeHistogram("audit_test_hist", 50);
    observeHistogram("audit_test_hist", 100);
    const snap = snapshotJson();
    expect(snap.histograms.audit_test_hist.count).toBeGreaterThanOrEqual(3);
  });
});

describe("renderPromText", () => {
  it("emits Prometheus-format gauges", () => {
    const txt = renderPromText();
    expect(txt).toMatch(/^# HELP ares_uptime_seconds/m);
    expect(txt).toMatch(/^ares_uptime_seconds \d+/m);
    expect(txt).toMatch(/^ares_memory_rss_bytes \d+/m);
  });
});

describe("snapshotJson", () => {
  it("returns a structured object", () => {
    const snap = snapshotJson();
    expect(typeof snap.uptimeSeconds).toBe("number");
    expect(snap.memory).toBeDefined();
    expect(typeof snap.memory.rss).toBe("number");
    expect(snap.counters).toBeDefined();
    expect(snap.histograms).toBeDefined();
  });
});
