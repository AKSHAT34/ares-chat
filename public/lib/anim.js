// Phase 7 — animation runtime helpers.
//
// Read once at boot:
//   - prefers-reduced-motion (used by callers that want to skip a
//     non-essential animation entirely instead of relying on the CSS
//     duration override).
//   - ares-anim-slow cookie. Set by hitting /api/dev/anim?slow=1; the
//     server reflects the cookie back. anim.js reads it at module load
//     and toggles `<html data-anim-slow="1">` so anim.css's slow-mo
//     ladder kicks in.
//
// Used as an ES module via `import { prefersReducedMotion, animTokens } from "./lib/anim.js"`.
// Pure-presentation; safe in jsdom for animation smoke tests.

export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined"
      && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Token names — caller can reference these in inline styles or
// via getComputedStyle to read the actual ms value.
export const animTokens = Object.freeze({
  easeOut: "var(--ease-out)",
  easeInOut: "var(--ease-in-out)",
  easeSpring: "var(--ease-spring)",
  durFast: "var(--dur-fast)",
  durBase: "var(--dur-base)",
  durSlow: "var(--dur-slow)",
  opacityFast: "var(--opacity-fast)",
});

// Read a CSS variable from :root and parse a millisecond duration from
// it. Returns NaN on failure so callers can fall back to a literal.
export function readDurationMs(varName) {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(varName).trim();
    const m = v.match(/^([\d.]+)\s*ms$/);
    if (m) return parseFloat(m[1]);
    const s = v.match(/^([\d.]+)\s*s$/);
    if (s) return parseFloat(s[1]) * 1000;
  } catch {}
  return NaN;
}

// Cookie-driven slow-mo toggle. Idempotent; runs at module load.
function _hasSlowCookie() {
  try {
    return /(?:^|;\s*)ares-anim-slow=1/.test(document.cookie || "");
  } catch { return false; }
}
function _applySlowMo() {
  if (typeof document === "undefined" || !document.documentElement) return;
  if (_hasSlowCookie()) {
    document.documentElement.dataset.animSlow = "1";
  } else {
    delete document.documentElement.dataset.animSlow;
  }
}
_applySlowMo();

// Re-apply if cookie changes within the page's lifetime (for dev who
// flips it via fetch then expects the page to update without reload).
// Cheap polling: 2 s, only checks document.cookie.
let _lastCookieState = _hasSlowCookie();
setInterval(() => {
  const cur = _hasSlowCookie();
  if (cur !== _lastCookieState) {
    _lastCookieState = cur;
    _applySlowMo();
  }
}, 2000);

// Test/debug introspection.
export const _internals = Object.freeze({
  hasSlowCookie: _hasSlowCookie,
  applySlowMo: _applySlowMo,
});
