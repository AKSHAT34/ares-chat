// Phase 3 — Token + Host-header auth for /api/*.
//
// Localhost-only is not a security boundary on its own:
//   - Any process running as the user can hit 127.0.0.1.
//   - DNS-rebinding attacks let a malicious site reach localhost via
//     attacker-controlled DNS that resolves a.evil.com → 127.0.0.1.
//
// We add two layers:
//   1. Bearer token in Authorization header. Token lives at
//      ~/.kiro/runtime/ares.token (mode 0600). Generated on boot if missing.
//      Same token survives restarts so existing browser tabs keep working.
//   2. Host header allowlist. Browsers always send Host=localhost:7777 or
//      127.0.0.1:7777. DNS-rebinding sends the attacker's host name. We
//      reject anything else with 403.
//
// /api/health is exempt from auth so launchd / monitoring / Electron's
// preflight ping can run without the token.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const RUNTIME_DIR = path.join(os.homedir(), ".kiro", "runtime");
const TOKEN_PATH = path.join(RUNTIME_DIR, "ares.token");
const ALLOWED_HOSTS = new Set([
  "localhost:7777",
  "127.0.0.1:7777",
  "[::1]:7777",
]);
const PUBLIC_PATHS = new Set([
  "/api/health",   // allow unauthenticated health checks
  "/api/metrics",  // Phase 9 — Prometheus-style scrape endpoint
  // Phase Q3 — auth handshake for the Q UI bundle (served from /q/).
  // Returns the bearer token IF AND ONLY IF the request comes from an
  // allowed Host (the host check fires BEFORE the public-path branch
  // post-E-1, so this is safe). The legacy / page templates the token
  // inline; the Q bundle is a static asset and reads the token here.
  "/api/auth-handshake",
]);

let _token = null;

/**
 * Load or create the bearer token. Idempotent.
 * Returns the current token. Does not log it.
 */
export function ensureToken() {
  if (_token) return _token;
  fs.mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
  if (fs.existsSync(TOKEN_PATH)) {
    _token = fs.readFileSync(TOKEN_PATH, "utf8").trim();
    if (_token && _token.length >= 32) return _token;
    // Malformed file — regenerate.
  }
  _token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(TOKEN_PATH, _token, { mode: 0o600 });
  return _token;
}

export function getTokenPath() { return TOKEN_PATH; }

/**
 * Express middleware. Mount before /api/* routes.
 * - Allows /api/health unauthenticated.
 * - Checks Host header against allowlist (DNS-rebinding defence).
 * - Requires `Authorization: Bearer <token>` on every other /api/* call.
 *
 * Returns:
 *   - 403 + { error: "host not allowed" } on bad Host
 *   - 401 + { error: "missing or invalid token" } on bad Authorization
 *   - calls next() on success
 */
export function authMiddleware(req, res, next) {
  // Only guard /api/*
  if (!req.path.startsWith("/api/")) return next();

  // E-1: Host check runs FIRST, before the public-path exemption. A
  // DNS-rebinding page hitting /api/health or /api/metrics carries the
  // attacker's hostname in the Host header — without this check it could
  // fingerprint workspace path / model id / process memory / route
  // templates without ever supplying a token.
  const host = (req.headers.host || "").toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    res.status(403).json({ error: "host not allowed", got: req.headers.host });
    return;
  }

  // Health + metrics remain token-free for launchd / Prometheus scraping
  // — but only AFTER the Host check above has confirmed the request is
  // genuinely from a browser hitting localhost.
  if (PUBLIC_PATHS.has(req.path)) return next();

  // Token check.
  const auth = req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/.exec(auth);
  const token = match ? match[1] : null;
  if (!token) {
    res.status(401).json({ error: "missing token" });
    return;
  }
  // Constant-time compare so timing doesn't leak info about token prefixes.
  const expected = ensureToken();
  if (
    token.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    res.status(401).json({ error: "invalid token" });
    return;
  }
  next();
}

/**
 * Helper for boot logging. Prints the token clearly so the user can copy
 * it into a browser tab once. Includes the file path for next time.
 */
export function logTokenForOperator(token) {
  console.log("=".repeat(60));
  console.log("Auth token for /api/* (paste once in browser settings):");
  console.log(`  ${token}`);
  console.log(`  (also stored at ${TOKEN_PATH}, mode 0600)`);
  console.log("=".repeat(60));
}
