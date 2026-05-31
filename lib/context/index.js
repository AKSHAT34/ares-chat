// Engine factory + selector. Reads ARES_CONTEXT_ENGINE (default "anchor")
// at construction time. The agent loop calls makeContextEngine() once per
// process, hands the same instance to every Agent it constructs.

import { AnchorContextEngine } from "./anchor.js";
import { HeadTruncateContextEngine } from "./head-truncate.js";
import { ContextEngine } from "./base.js";

export { ContextEngine, AnchorContextEngine, HeadTruncateContextEngine };

const REGISTRY = {
  "anchor": AnchorContextEngine,
  "head-truncate": HeadTruncateContextEngine,
};

/**
 * Create a context engine. Falls back to "anchor" if the requested name is
 * unknown — never throws — so an env-var typo doesn't crash boot.
 *
 * @param {string} [name] — defaults to process.env.ARES_CONTEXT_ENGINE
 * @returns {ContextEngine}
 */
export function makeContextEngine(name) {
  const requested = (name || process.env.ARES_CONTEXT_ENGINE || "anchor").toLowerCase();
  const Cls = REGISTRY[requested];
  if (!Cls) {
    console.warn(`[context] unknown engine "${requested}"; falling back to "anchor"`);
    return new AnchorContextEngine();
  }
  return new Cls();
}

/** Names of every available engine. Useful for the doctor probe (Phase U18). */
export function listContextEngines() {
  return Object.keys(REGISTRY);
}
