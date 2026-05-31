// Phase-4 audit · D-9 · histogram ring-buffer must cap memory at HIST_MAX_SAMPLES.
//
// Pre-fix: each observation appended to a flat array; the cap was enforced
// via Array.prototype.shift() — O(n) per call. Under sustained load that's
// 1024 element shifts per observation. Post-fix: ring buffer with O(1)
// writes and a single materialise step at /api/metrics scrape time.

import { describe, it, expect } from "vitest";
import { observeHistogram, renderPromText, snapshotJson } from "../lib/observability.js";

describe("Phase-4 D-9 · histogram ring buffer", () => {
  it("samples beyond the 1024 cap don't grow memory unbounded", () => {
    // Push 5000 samples — far past the cap.
    for (let i = 0; i < 5000; i++) {
      observeHistogram(`http_request_duration_ms{route="/test/d9"}`, i);
    }
    const snap = snapshotJson();
    const found = snap.histograms[`http_request_duration_ms{route="/test/d9"}`];
    expect(found).toBeTruthy();
    // Ring is fixed-size 1024; any window of 1024 consecutive samples is
    // valid. The newest values should be present so p99 is high.
    expect(found.count).toBe(1024);
    expect(found.p99).toBeGreaterThan(4000);
  });

  it("renderPromText emits sum/count for the cumulative ring window", () => {
    // Fresh route name to isolate from the earlier test.
    for (let i = 0; i < 100; i++) {
      observeHistogram(`http_request_duration_ms{route="/test/d9-render"}`, i);
    }
    const text = renderPromText();
    expect(text).toMatch(/http_request_duration_ms_count\{route="\/test\/d9-render"\} 100/);
    // Sum of 0..99 == 4950
    expect(text).toMatch(/http_request_duration_ms_sum\{route="\/test\/d9-render"\} 4950/);
  });

  it("ring wraps so the oldest samples are dropped, not the newest", () => {
    // Fresh route. Push 1024 low values then 100 high values; the
    // resulting window MUST contain the high values (they're newest).
    for (let i = 0; i < 1024; i++) observeHistogram(`http_request_duration_ms{route="/test/d9-wrap"}`, 1);
    for (let i = 0; i < 100; i++) observeHistogram(`http_request_duration_ms{route="/test/d9-wrap"}`, 9999);
    const snap = snapshotJson();
    const h = snap.histograms[`http_request_duration_ms{route="/test/d9-wrap"}`];
    expect(h.count).toBe(1024);
    // p99 over the window must reflect the recent 100 high values.
    expect(h.p99).toBe(9999);
  });
});
