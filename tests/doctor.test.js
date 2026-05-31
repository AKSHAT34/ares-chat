// Phase U18 — doctor probe tests.

import { describe, it, expect } from "vitest";
import { runDoctor } from "../lib/doctor.js";

describe("doctor — runDoctor surface", () => {
  it("returns an object with overall + checks[] + generatedAt", async () => {
    const r = await runDoctor();
    expect(["ok", "warn", "fail"]).toContain(r.overall);
    expect(Array.isArray(r.checks)).toBe(true);
    expect(r.checks.length).toBeGreaterThanOrEqual(8);
    expect(typeof r.generatedAt).toBe("string");
    // ISO timestamp
    expect(() => new Date(r.generatedAt).toISOString()).not.toThrow();
  });

  it("each check has name + status + (info or suggestion)", async () => {
    const r = await runDoctor();
    for (const c of r.checks) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(["ok", "warn", "fail"]).toContain(c.status);
      // At least one of info/suggestion is present (info is mandatory in
      // most paths; suggestion only on warn/fail).
      expect(c.info || c.suggestion).toBeTruthy();
    }
  });

  it("includes the canonical core checks", async () => {
    const r = await runDoctor();
    const names = r.checks.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining([
      "AWS credentials",
      "AuthProvider cookie",
      "Bedrock cred cache",
      "Prompt cache",
      "Sandbox",
      "Sessions dir writable",
      "~/.ares perms",
      "Recent jobs",
      "Voice / Transcribe SDK",
    ]));
  });

  it("overall is the worst-status colour", async () => {
    const r = await runDoctor();
    const hasFail = r.checks.some((c) => c.status === "fail");
    const hasWarn = r.checks.some((c) => c.status === "warn");
    if (hasFail) expect(r.overall).toBe("fail");
    else if (hasWarn) expect(r.overall).toBe("warn");
    else expect(r.overall).toBe("ok");
  });
});
