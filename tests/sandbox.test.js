// Phase U09 — sandbox backend tests.

import { describe, it, expect } from "vitest";
import { LocalSandbox, DockerSandbox, getSandbox, setSandbox, listSandboxes, sandboxStatus } from "../lib/sandbox/index.js";

describe("LocalSandbox", () => {
  it("name + description", () => {
    const s = new LocalSandbox();
    expect(s.name).toBe("local");
    // Phase-5 E-9 changed the description from "no isolation" to
    // "minimal-env passthrough" once the AWS_*/ARES_* env was removed.
    // Either phrase signals the same backend; keep both as acceptable.
    expect(s.description).toMatch(/host shell/);
  });

  it("runs a benign command and returns stdout + exit 0", async () => {
    const s = new LocalSandbox();
    const r = await s.exec({ command: "echo hello-from-sandbox" });
    expect(r.stdout).toMatch(/hello-from-sandbox/);
    expect(r.exitCode).toBe(0);
    expect(typeof r.durationMs).toBe("number");
  });

  it("propagates non-zero exit code", async () => {
    const s = new LocalSandbox();
    const r = await s.exec({ command: "exit 3" });
    expect(r.exitCode).toBe(3);
  });

  it("captures stderr separately from stdout", async () => {
    const s = new LocalSandbox();
    const r = await s.exec({ command: "echo out >&1; echo err >&2" });
    expect(r.stdout).toMatch(/out/);
    expect(r.stderr).toMatch(/err/);
  });

  it("rejects when timeout fires", async () => {
    const s = new LocalSandbox();
    await expect(s.exec({ command: "sleep 5", timeout: 200 })).rejects.toThrow(/timeout/);
  });

  it("rejects when abortSignal fires", async () => {
    const s = new LocalSandbox();
    const c = new AbortController();
    setTimeout(() => c.abort(), 100);
    await expect(s.exec({ command: "sleep 5", abortSignal: c.signal })).rejects.toThrow();
  });

  it("rejects empty command", async () => {
    const s = new LocalSandbox();
    await expect(s.exec({ command: "" })).rejects.toThrow(/command is required/);
  });
});

describe("DockerSandbox (shape only — no actual docker exec)", () => {
  it("name + description", () => {
    const s = new DockerSandbox();
    expect(s.name).toBe("docker");
    expect(s.description).toMatch(/ephemeral container/);
    expect(s.description).toMatch(/--network=none/);
    expect(s.description).toMatch(/non-root/);
  });

  it("rejects empty command without spawning docker", async () => {
    const s = new DockerSandbox();
    await expect(s.exec({ command: "" })).rejects.toThrow(/command is required/);
  });
});

describe("sandbox factory", () => {
  it("default is local", () => {
    const s = getSandbox("local");
    expect(s.name).toBe("local");
  });

  it("listSandboxes returns both built-ins", () => {
    const list = listSandboxes();
    expect(list).toContain("local");
    expect(list).toContain("docker");
    // Audit-relevant: must NOT contain Modal/Daytona/SSH/Vercel/Singularity.
    for (const banned of ["modal", "daytona", "ssh", "vercel", "singularity"]) {
      expect(list).not.toContain(banned);
    }
  });

  it("setSandbox switches the active backend", () => {
    const s = setSandbox("docker");
    expect(s.name).toBe("docker");
    const status = sandboxStatus();
    expect(status.active).toBe("docker");
    // Switch back so we don't bleed across tests.
    setSandbox("local");
  });

  it("setSandbox throws on unknown backend", () => {
    expect(() => setSandbox("modal")).toThrow(/unknown sandbox backend/);
    expect(() => setSandbox("vercel")).toThrow(/unknown sandbox backend/);
  });

  it("sandboxStatus exposes active + description + available", () => {
    setSandbox("local");
    const s = sandboxStatus();
    expect(s.active).toBe("local");
    expect(typeof s.description).toBe("string");
    expect(Array.isArray(s.available)).toBe(true);
  });
});
