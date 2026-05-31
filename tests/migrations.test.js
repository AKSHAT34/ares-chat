// Phase 10 — unit tests for lib/migrations.js.

import { describe, it, expect } from "vitest";
import { CURRENT_SCHEMA, MIGRATIONS, migrate, stampCurrent, getSchemaVersion } from "../lib/migrations.js";

describe("getSchemaVersion", () => {
  it("treats missing schemaVersion as 0", () => {
    expect(getSchemaVersion({ id: "x", messages: [] })).toBe(0);
  });

  it("returns the numeric schemaVersion", () => {
    expect(getSchemaVersion({ schemaVersion: 1 })).toBe(1);
    expect(getSchemaVersion({ schemaVersion: 5 })).toBe(5);
  });

  it("treats non-numeric schemaVersion as 0", () => {
    expect(getSchemaVersion({ schemaVersion: "foo" })).toBe(0);
    expect(getSchemaVersion({ schemaVersion: NaN })).toBe(0);
  });

  it("returns null for non-object input", () => {
    expect(getSchemaVersion(null)).toBe(null);
    expect(getSchemaVersion(42)).toBe(null);
  });
});

describe("migrate", () => {
  it("upgrades v0 to CURRENT_SCHEMA", () => {
    const out = migrate({ id: "x", messages: [] });
    expect(out.session.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(out.applied).toContain("0→1");
  });

  it("is a no-op for already-current sessions", () => {
    const out = migrate({ id: "x", messages: [], schemaVersion: CURRENT_SCHEMA });
    expect(out.unchanged).toBe(true);
    expect(out.applied).toEqual([]);
  });

  it("rejects from-the-future schema versions", () => {
    expect(() => migrate({ id: "x", messages: [], schemaVersion: CURRENT_SCHEMA + 5 })).toThrow(/Refusing to load|future|only understands/);
  });

  it("preserves all session fields through migration", () => {
    const out = migrate({ id: "x", messages: [{ role: "user", content: "hi" }], title: "T", pinned: true });
    expect(out.session.id).toBe("x");
    expect(out.session.title).toBe("T");
    expect(out.session.pinned).toBe(true);
    expect(out.session.messages).toHaveLength(1);
  });
});

describe("stampCurrent", () => {
  it("sets schemaVersion to CURRENT_SCHEMA", () => {
    const out = stampCurrent({ id: "x" });
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA);
  });

  it("overwrites an older version", () => {
    const out = stampCurrent({ id: "x", schemaVersion: 0 });
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA);
  });
});

describe("MIGRATIONS array", () => {
  it("has a continuous chain from 0 to CURRENT_SCHEMA", () => {
    let v = 0;
    while (v < CURRENT_SCHEMA) {
      const m = MIGRATIONS.find((x) => x.from === v);
      expect(m, `migrator from=${v} missing`).toBeDefined();
      v = m.to;
    }
    expect(v).toBe(CURRENT_SCHEMA);
  });
});
