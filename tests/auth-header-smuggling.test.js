// Phase-5 audit · E-16 · auth middleware must reject smuggled Host headers.
//
// Threat: a DNS-rebound page sending `Host: 127.0.0.1:7777\r\nX-Forwarded:
// evil.com` could try to confuse the host-allowlist check. Express + Node's
// http parser already strip CRLF from header values during ingestion, so
// a literal CRLF in req.headers.host is not reachable in practice. Still:
// (a) prove the allowlist comparison is exact-match on a set, not a
//     prefix or substring check;
// (b) prove case-insensitivity (Host: 127.0.0.1:7777 == 127.0.0.1:7777);
// (c) prove that any non-allowlisted host is rejected with 403, including
//     /api/health and /api/metrics post-Phase-5 E-1.

import { describe, it, expect, beforeEach } from "vitest";
import { authMiddleware } from "../lib/auth.js";

function makeReqRes({ host, path = "/api/sessions", auth = null }) {
  const req = { headers: { host, authorization: auth }, path };
  let statusCode = null;
  let body = null;
  let nextCalled = false;
  const res = {
    status(c) { statusCode = c; return res; },
    json(b) { body = b; return res; },
  };
  const next = () => { nextCalled = true; };
  authMiddleware(req, res, next);
  return { statusCode, body, nextCalled };
}

describe("Phase-5 E-16 · auth middleware host-smuggling defense", () => {
  it("accepts canonical localhost variants", () => {
    for (const host of ["localhost:7777", "127.0.0.1:7777", "[::1]:7777"]) {
      const r = makeReqRes({ host, auth: null });
      // Without a token, /api/sessions returns 401 — but the host check
      // must pass first (no 403).
      expect(r.statusCode).toBe(401);
    }
  });

  it("rejects an attacker-controlled Host with 403 BEFORE token check", () => {
    const r = makeReqRes({ host: "evil.com", auth: "Bearer wrong" });
    expect(r.statusCode).toBe(403);
    expect(r.body?.error).toBe("host not allowed");
  });

  it("rejects a Host that PREFIX-matches an allowed value (no substring trickery)", () => {
    const r = makeReqRes({ host: "127.0.0.1:7777.evil.com", auth: null });
    expect(r.statusCode).toBe(403);
  });

  it("rejects a Host that SUFFIX-matches an allowed value (no substring trickery)", () => {
    const r = makeReqRes({ host: "evil.127.0.0.1:7777", auth: null });
    expect(r.statusCode).toBe(403);
  });

  it("E-1: enforces host check on /api/health (post-Phase-5 fix)", () => {
    const ok = makeReqRes({ host: "127.0.0.1:7777", path: "/api/health" });
    expect(ok.nextCalled).toBe(true);
    const bad = makeReqRes({ host: "evil.com", path: "/api/health" });
    expect(bad.statusCode).toBe(403);
  });

  it("E-1: enforces host check on /api/metrics (post-Phase-5 fix)", () => {
    const ok = makeReqRes({ host: "127.0.0.1:7777", path: "/api/metrics" });
    expect(ok.nextCalled).toBe(true);
    const bad = makeReqRes({ host: "evil.com", path: "/api/metrics" });
    expect(bad.statusCode).toBe(403);
  });

  it("missing Host header → 403", () => {
    const r = makeReqRes({ host: undefined, auth: null });
    expect(r.statusCode).toBe(403);
  });

  it("Host header is case-insensitive (browsers may send mixed case)", () => {
    const r = makeReqRes({ host: "LOCALHOST:7777", auth: null });
    // 401 (no token) means host check passed.
    expect(r.statusCode).toBe(401);
  });
});
