// Phase RP1-B5 — content-insensitive fingerprint of a tool_use input.
//
// The agent's loop detector v1 keyed on the exact JSON.stringify of
// args, which let "5 shell_exec calls with slight command variations"
// slip through. v2 keys on the *shape* — the structure + leaf TYPES,
// without the leaf values. So {command:"ls /tmp"} and
// {command:"ls /var"} collide; {command} and {command, cwd} don't.
//
// Contract:
//   shapeHash(args, {maxBytes=4096}) → string (hex SHA-1 of the shape JSON)
//   shapeOf(args)                    → JSON-serialisable structural copy
//
// Hashing is bounded to the first `maxBytes` of the shape JSON to keep
// detection fast on huge inputs. Collisions in the tail are not
// interesting for loop detection — by the time we're looking at a 100KB
// tail, the head already disambiguated.

import { createHash } from "node:crypto";

const STR_TOKEN = "<str>";
const NUM_TOKEN = "<num>";
const BOOL_TOKEN = "<bool>";
const NULL_TOKEN = "<null>";

/**
 * Walk a value, replacing every leaf with a type token. Preserves
 * object key order (Object.keys returns insertion order on
 * non-numeric keys) so two inputs with the same key set + shapes get
 * identical output. Arrays preserve length and per-index structure.
 */
export function shapeOf(value) {
  if (value === null) return NULL_TOKEN;
  if (Array.isArray(value)) return value.map(shapeOf);
  switch (typeof value) {
    case "string":   return STR_TOKEN;
    case "number":   return NUM_TOKEN;
    case "boolean":  return BOOL_TOKEN;
    case "object": {
      const out = {};
      // Object.keys gives insertion order; sort for stability so
      // {a, b} and {b, a} hash the same. Tools that rely on key
      // order are vanishingly rare and any such tool would have
      // bigger problems than loop detection.
      for (const k of Object.keys(value).sort()) out[k] = shapeOf(value[k]);
      return out;
    }
    default:         return NULL_TOKEN; // undefined / function / symbol — coerce
  }
}

/**
 * Hex SHA-1 of the shape JSON, truncated to maxBytes before hashing
 * so huge inputs don't dominate the budget.
 */
export function shapeHash(value, { maxBytes = 4096 } = {}) {
  const json = JSON.stringify(shapeOf(value) ?? null);
  const head = json.length > maxBytes ? json.slice(0, maxBytes) : json;
  return createHash("sha1").update(head).digest("hex");
}
