// Q-pass-3 (D) — probe Chrome's remote-debug port (CDP).
//
// `chrome://inspect/#remote-debugging` instructs the user to launch
// Chrome with `--remote-debugging-port=9222`. When that's running,
// `http://localhost:9222/json/version` returns a JSON blob describing
// the browser. We surface ok/version/error to the Settings UI so the
// user can confirm onboarding without leaving the app.

import http from "node:http";

const DEFAULT_PORT = 9222;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_TIMEOUT_MS = 1500;

/**
 * Hit /json/version on the configured CDP port.
 * Returns { ok: boolean, version?: object, error?: string }.
 * Never throws — failures resolve as { ok: false, error }.
 */
export function testDebugConnection({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    const req = http.get({
      host, port, path: "/json/version", timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          finish({ ok: false, error: `HTTP ${res.statusCode}` });
          return;
        }
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          const j = JSON.parse(body);
          finish({ ok: true, version: j });
        } catch (e) {
          finish({ ok: false, error: `bad JSON: ${e.message}` });
        }
      });
    });
    req.on("timeout", () => {
      try { req.destroy(); } catch {}
      finish({ ok: false, error: `timeout after ${timeoutMs}ms — is Chrome running with --remote-debugging-port=${port}?` });
    });
    req.on("error", (e) => {
      const msg = e && e.code === "ECONNREFUSED"
        ? `Chrome remote debug port ${port} is not open. Open Chrome and visit chrome://inspect, or relaunch with --remote-debugging-port=${port}.`
        : (e.message || String(e));
      finish({ ok: false, error: msg });
    });
  });
}

export const CDP_DEFAULTS = { host: DEFAULT_HOST, port: DEFAULT_PORT };
