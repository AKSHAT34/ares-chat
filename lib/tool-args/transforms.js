// Phase RP1-B3 — argument-transform primitives.
//
// A "transform" is a tiny declarative instruction the hub applies
// before dispatch when args look likely to fail. Three primitives:
//
//   inject:<jsonPath>=<expr>      add a missing field
//   rename:<from>->:<to>          rename a key
//   coerce:<jsonPath>:<type>      coerce a value to the given type
//
// All three primitives are conservative — they NEVER overwrite an
// existing user-provided value, only fix what's missing/wrong.

/** Get a value at a dotted path; returns undefined if any segment is missing. */
function getPath(obj, p) {
  if (!obj || typeof obj !== "object" || !p) return undefined;
  const parts = p.split(".");
  let cur = obj;
  for (const seg of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[seg];
  }
  return cur;
}

function setPath(obj, p, value) {
  const parts = p.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (cur[seg] == null || typeof cur[seg] !== "object") cur[seg] = {};
    cur = cur[seg];
  }
  cur[parts[parts.length - 1]] = value;
}

function deletePath(obj, p) {
  const parts = p.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return;
    cur = cur[parts[i]];
  }
  if (cur && typeof cur === "object") delete cur[parts[parts.length - 1]];
}

/**
 * Parse a transform spec ("inject:foo.bar=42") into {kind, …}. The
 * value half is JSON-parsed (so strings need quotes); falls back to
 * the raw string on parse failure.
 */
export function parseTransform(spec) {
  if (typeof spec !== "string") throw new Error("transform spec must be a string");
  if (spec.startsWith("inject:")) {
    const body = spec.slice("inject:".length);
    const eq = body.indexOf("=");
    if (eq < 0) throw new Error(`bad inject spec (missing '='): ${spec}`);
    const path = body.slice(0, eq);
    const valStr = body.slice(eq + 1);
    let value;
    try { value = JSON.parse(valStr); }
    catch { value = valStr; }
    return { kind: "inject", path, value };
  }
  if (spec.startsWith("rename:")) {
    const body = spec.slice("rename:".length);
    const arrow = body.indexOf("->");
    if (arrow < 0) throw new Error(`bad rename spec (missing '->'): ${spec}`);
    return { kind: "rename", from: body.slice(0, arrow), to: body.slice(arrow + 2) };
  }
  if (spec.startsWith("coerce:")) {
    const body = spec.slice("coerce:".length);
    const colon = body.lastIndexOf(":");
    if (colon < 0) throw new Error(`bad coerce spec (missing type): ${spec}`);
    return { kind: "coerce", path: body.slice(0, colon), type: body.slice(colon + 1) };
  }
  throw new Error(`unknown transform kind: ${spec}`);
}

/**
 * Apply a parsed transform to a CLONE of args. Returns
 * `{args, applied: bool, reason: string}`. Never mutates the input.
 */
export function applyTransform(args, transform) {
  const out = JSON.parse(JSON.stringify(args || {}));
  switch (transform.kind) {
    case "inject": {
      const cur = getPath(out, transform.path);
      // Conservative: only inject when the target is currently missing.
      if (cur === undefined || cur === null || cur === "") {
        setPath(out, transform.path, transform.value);
        return { args: out, applied: true, reason: `injected ${transform.path}` };
      }
      return { args: out, applied: false, reason: "target already set" };
    }
    case "rename": {
      // Only rename if `to` is missing AND `from` is present.
      const fromVal = getPath(out, transform.from);
      const toVal = getPath(out, transform.to);
      if (fromVal !== undefined && (toVal === undefined || toVal === null)) {
        setPath(out, transform.to, fromVal);
        deletePath(out, transform.from);
        return { args: out, applied: true, reason: `renamed ${transform.from} → ${transform.to}` };
      }
      return { args: out, applied: false, reason: "rename preconditions unmet" };
    }
    case "coerce": {
      const cur = getPath(out, transform.path);
      if (cur === undefined) return { args: out, applied: false, reason: "missing target" };
      const coerced = coerce(cur, transform.type);
      if (coerced === cur) return { args: out, applied: false, reason: "already correct type" };
      setPath(out, transform.path, coerced);
      return { args: out, applied: true, reason: `coerced ${transform.path} → ${transform.type}` };
    }
    default:
      return { args: out, applied: false, reason: `unknown kind: ${transform.kind}` };
  }
}

function coerce(value, type) {
  switch (type) {
    case "array":
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        // Try JSON-array first, then comma-split as a fallback.
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch { /* fall through */ }
        return value.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [value];
    case "string": return typeof value === "string" ? value : String(value);
    case "number": {
      if (typeof value === "number") return value;
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      if (value === "true" || value === 1 || value === "1") return true;
      if (value === "false" || value === 0 || value === "0") return false;
      return Boolean(value);
    default:
      return value;
  }
}
