// Q-pass-4 (E) — unified activity stream.
//
// Exercises emit/subscribe + the SSE handler. We don't spin up an HTTP
// server; instead we hand the handler a fake req/res that captures the
// data: frames and assert the shape.

import { describe, it, expect, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MOD = path.join(__dirname, "..", "lib", "activity-stream.js");

function makeFakeReqRes() {
  const writes = [];
  const headers = {};
  const req = new EventEmitter();
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    flushHeaders: () => {},
    write: (s) => { writes.push(s); return true; },
    end: () => {},
  };
  return { req, res, writes, headers };
}

function parseFrames(writes) {
  const frames = [];
  for (const w of writes) {
    if (w.startsWith(":")) continue; // keepalive comment
    if (!w.startsWith("data: ")) continue;
    const json = w.slice(6).replace(/\n\n$/, "");
    try { frames.push(JSON.parse(json)); } catch { /* ignore */ }
  }
  return frames;
}

describe("Q-pass-4 (E) · activity-stream emit/subscribe", () => {
  let mod;
  beforeEach(async () => {
    mod = await import(`${MOD}?t=${Date.now()}-${Math.random()}`);
    mod._resetForTests();
  });

  it("emit + subscribe round-trips an event with all fields", async () => {
    const got = [];
    const off = mod.subscribe((ev) => got.push(ev));
    mod.emitActivity({ source: "jobs", type: "run_started", payload: { jobId: "kpi-cache" } });
    off();
    expect(got.length).toBe(1);
    expect(got[0].source).toBe("jobs");
    expect(got[0].type).toBe("run_started");
    expect(got[0].payload).toEqual({ jobId: "kpi-cache" });
    expect(typeof got[0].ts).toBe("number");
  });

  it("delivers one frame per source through the SSE handler", async () => {
    const { req, res, writes } = makeFakeReqRes();
    mod.handleActivityStream(req, res);
    // Emit one event per documented source.
    const sources = ["jobs", "gateway", "approvals", "errors", "memory"];
    for (const src of sources) {
      mod.emitActivity({ source: src, type: `${src}_event`, payload: { hello: src } });
    }
    // Close the connection — the handler unhooks via the close event.
    req.emit("close");

    const frames = parseFrames(writes);
    // First frame is the "hello" control event the handler always sends.
    expect(frames[0].type).toBe("hello");
    // Each emit must produce a frame, in order, with the expected source.
    const after = frames.slice(1);
    expect(after.length).toBe(sources.length);
    for (let i = 0; i < sources.length; i++) {
      expect(after[i].source).toBe(sources[i]);
      expect(after[i].type).toBe(`${sources[i]}_event`);
      expect(after[i].payload.hello).toBe(sources[i]);
    }
  });

  it("ignores emits with no source", async () => {
    const got = [];
    const off = mod.subscribe((ev) => got.push(ev));
    mod.emitActivity({ type: "broken" });
    mod.emitActivity(null);
    mod.emitActivity({ source: "jobs", type: "good" });
    off();
    expect(got.length).toBe(1);
    expect(got[0].type).toBe("good");
  });

  it("auto-stamps ts when caller omits it", async () => {
    const got = [];
    const off = mod.subscribe((ev) => got.push(ev));
    mod.emitActivity({ source: "memory", type: "record" });
    off();
    expect(typeof got[0].ts).toBe("number");
    expect(got[0].ts).toBeGreaterThan(0);
  });

  it("wireActivityStream forwards jobRunner.events and feedHub events", async () => {
    const jobBus = new EventEmitter();
    const feedBus = new EventEmitter();
    const jobRunner = { events: jobBus };
    mod.wireActivityStream({ jobRunner, feedHub: feedBus });

    const got = [];
    const off = mod.subscribe((ev) => got.push(ev));
    jobBus.emit("event", { type: "run_started", id: "job-1" });
    feedBus.emit("item", { id: "slack:CX:123", title: "ping" });
    feedBus.emit("read", "slack:CX:123");
    off();

    const sources = got.map((g) => g.source);
    expect(sources).toContain("jobs");
    expect(sources).toContain("gateway");
    const jobEv = got.find((g) => g.source === "jobs");
    expect(jobEv.payload.id).toBe("job-1");
    const itemEv = got.find((g) => g.source === "gateway" && g.type === "item");
    expect(itemEv.payload.id).toBe("slack:CX:123");
  });
});
