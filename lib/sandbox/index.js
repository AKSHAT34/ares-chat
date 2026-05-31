// Sandbox backend factory + selector.
//
// Reads ARES_SANDBOX (default "local"). Allowlist is hardcoded so the
// only way to add a backend is to commit a new one — no plugin escape
// hatch for runtimes the upgrade plan banned (Modal/Daytona/SSH/etc).

import { LocalSandbox } from "./local.js";
import { DockerSandbox } from "./docker.js";
import { SandboxBackend } from "./base.js";

export { SandboxBackend, LocalSandbox, DockerSandbox };

const REGISTRY = {
  "local": LocalSandbox,
  "docker": DockerSandbox,
};

let _activeName = null;
let _active = null;

/**
 * Construct (or fetch the cached) sandbox backend. Singleton per-process.
 *
 * Calling without a name returns the currently-active backend if one was
 * already initialised — even if env/default would resolve to something
 * else. This lets `setSandbox()` runtime-switches survive subsequent
 * `getSandbox()` lookups from the hub.
 */
export function getSandbox(name) {
  // No name passed AND we already have an active backend → return cache.
  // This is the hot path used by mcp-client.callTool on every shell
  // dispatch; preserving runtime switches is essential.
  if (!name && _active) return _active;
  const requested = (name || process.env.ARES_SANDBOX || "local").toLowerCase();
  if (_active && _activeName === requested) return _active;
  const Cls = REGISTRY[requested];
  if (!Cls) {
    console.warn(`[sandbox] unknown ARES_SANDBOX="${requested}"; falling back to "local"`);
    _active = new LocalSandbox();
    _activeName = "local";
    return _active;
  }
  _active = new Cls();
  _activeName = requested;
  console.log(`[sandbox] active backend: ${_active.name}`);
  return _active;
}

/** Override the active backend at runtime — used by `POST /api/sandbox/switch`. */
export function setSandbox(name) {
  const requested = (name || "local").toLowerCase();
  const Cls = REGISTRY[requested];
  if (!Cls) throw new Error(`unknown sandbox backend: ${requested}`);
  _active = new Cls();
  _activeName = requested;
  console.log(`[sandbox] switched to: ${_active.name}`);
  return _active;
}

/** Names of every available backend. Drives the doctor probe + tray menu. */
export function listSandboxes() {
  return Object.keys(REGISTRY);
}

/** Lightweight status payload for /api/health and /api/sandbox/status. */
export function sandboxStatus() {
  // IMPORTANT: don't call getSandbox() with no name — its env-resolved
  // default ("local") would overwrite a runtime setSandbox("docker")
  // when called as a status probe. Read _active directly; if it hasn't
  // been initialised yet, lazily resolve from env.
  if (!_active) getSandbox();
  return {
    active: _active.name,
    description: _active.description,
    available: listSandboxes(),
  };
}
