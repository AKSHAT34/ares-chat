// Phase 5 — schema versioning for on-disk session JSON.
//
// Every session.json now carries `schemaVersion`. CURRENT_SCHEMA is what
// the running code expects. Older files are upgraded one step at a time
// through MIGRATIONS until they match CURRENT_SCHEMA. Newer-than-CURRENT
// files are rejected (we never silently downgrade).
//
// Adding a new schema version:
//   1. Bump CURRENT_SCHEMA.
//   2. Append a migrator { from, to, up(session) } to MIGRATIONS that
//      transforms a `from`-shaped session into a `to`-shaped one.
//   3. Land an audit-phase test that exercises the up() transform with
//      a fixture from the previous version.
//
// A migrator MUST be idempotent in the sense that running it on already-
// migrated data should be a no-op or detected and skipped — the runner
// guards by checking `schemaVersion` before applying, so migrators can
// assume they only see input at exactly `from`.

export const CURRENT_SCHEMA = 1;

// Each migrator: { from, to, up(session) → session }.
// Empty today — v1 is the inaugural version. We keep the array (and a
// "v0 → v1" stamper below) so the framework is exercised and future
// migrations have a working pattern to copy.
export const MIGRATIONS = [
  {
    from: 0,
    to: 1,
    // v0 was "no schemaVersion field at all" — anything we wrote before
    // Phase 5 lands. There is nothing to transform; we're just stamping
    // the version so future readers can route confidently.
    up(session) {
      return { ...session, schemaVersion: 1 };
    },
  },
];

/**
 * Detect a session's schema version. Older files have no field; treat as 0.
 */
export function getSchemaVersion(session) {
  if (!session || typeof session !== "object") return null;
  const v = session.schemaVersion;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

/**
 * Migrate a session up to CURRENT_SCHEMA. Returns { session, applied[],
 * unchanged } where `applied` lists each step taken.
 *
 * Throws if the session is from the future (schemaVersion > CURRENT_SCHEMA).
 * Throws if no migrator exists for a needed step.
 */
export function migrate(session) {
  let cur = getSchemaVersion(session);
  if (cur === null) throw new Error("migrate: input is not a session object");
  if (cur > CURRENT_SCHEMA) {
    throw new Error(
      `session is schemaVersion=${cur}, but this build only understands up to ${CURRENT_SCHEMA}. ` +
      `Refusing to load — running an old build against newer data could corrupt it.`
    );
  }
  const applied = [];
  let out = session;
  while (cur < CURRENT_SCHEMA) {
    const m = MIGRATIONS.find((x) => x.from === cur);
    if (!m) throw new Error(`no migrator from schemaVersion=${cur}`);
    out = m.up(out);
    cur = m.to;
    applied.push(`${m.from}→${m.to}`);
  }
  return { session: out, applied, unchanged: applied.length === 0 };
}

/**
 * Stamp a fresh session with the current schema version. Use at write
 * sites that build a session from scratch (e.g. POST /api/sessions).
 */
export function stampCurrent(session) {
  return { ...session, schemaVersion: CURRENT_SCHEMA };
}
