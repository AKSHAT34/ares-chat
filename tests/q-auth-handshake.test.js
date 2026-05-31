// Phase Q3 — /api/auth-handshake must:
//   1. Return the bearer token to allowed Hosts (loopback only).
//   2. Refuse non-loopback Hosts with 403 (DNS-rebinding defence).
//   3. Stay in PUBLIC_PATHS so the Q UI bundle can fetch it without
//      a token of its own.
//
// We exercise the lib/auth.js host gate directly (no need to spin up
// an Express app). The Express handler itself is just `pageHostOk`
// + `ensureToken()`; we cover the 403 path via the static gate.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { authMiddleware } from "../lib/auth.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function makeReqRes({ host, path: p = "/api/auth-handshake", auth = null }) {
  const req = { headers: { host, authorization: auth }, path: p };
  let statusCode = 200;
  let body = null;
  let nextCalled = false;
  const res = {
    status(c) { statusCode = c; return res; },
    json(b) { body = b; return res; },
  };
  authMiddleware(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled };
}

describe("Phase Q3 · /api/auth-handshake auth wiring", () => {
  it("server.js registers the route + page-host check", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "server.js"),
      "utf8",
    );
    expect(src).toMatch(/app\.get\("\/api\/auth-handshake"/);
    expect(src).toMatch(/pageHostOk\(req\)/);
  });

  it("PUBLIC_PATHS in lib/auth.js includes the handshake", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "lib", "auth.js"),
      "utf8",
    );
    expect(src).toMatch(/"\/api\/auth-handshake"/);
  });

  it("authMiddleware lets allowed Hosts through to the handler", () => {
    const r = makeReqRes({ host: "127.0.0.1:7777" });
    expect(r.nextCalled).toBe(true);
  });

  it("authMiddleware rejects non-loopback Hosts with 403", () => {
    const r = makeReqRes({ host: "evil.com" });
    expect(r.statusCode).toBe(403);
    expect(r.nextCalled).toBe(false);
  });
});
