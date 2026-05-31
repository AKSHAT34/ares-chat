// Phase-5 audit · E-9 · LocalSandbox must NOT inherit AWS_* / ARES_* env.
//
// Pre-fix `env: process.env` passed the parent's full environment to the
// spawned shell — an adversarial tool result that convinced the agent to
// run `env > /tmp/leak` would exfil AWS keys + bearer tokens.
//
// Post-fix: minimal env (PATH/HOME/USER/SHELL/LANG/LC_ALL/TERM). Opt-in
// via opts.passEnvNames for the few callers that legitimately need
// extra variables.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalSandbox } from "../lib/sandbox/local.js";

const SECRET_VARS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "ARES_TOKEN",
];

const PRIOR = {};

beforeEach(() => {
  for (const v of SECRET_VARS) {
    PRIOR[v] = process.env[v];
    process.env[v] = `__test-secret-${v}__`;
  }
});

afterEach(() => {
  for (const v of SECRET_VARS) {
    if (PRIOR[v] === undefined) delete process.env[v];
    else process.env[v] = PRIOR[v];
  }
});

describe("Phase-5 E-9 · LocalSandbox env allowlist", () => {
  it("`env` inside the sandbox does NOT contain AWS_* / ARES_* secrets", async () => {
    const s = new LocalSandbox();
    const r = await s.exec({ command: "env | sort" });
    expect(r.exitCode).toBe(0);
    for (const v of SECRET_VARS) {
      expect(r.stdout).not.toContain(`__test-secret-${v}__`);
    }
  }, 20_000);

  it("PATH and HOME are still propagated (so commands actually resolve)", async () => {
    const s = new LocalSandbox();
    const r = await s.exec({ command: 'echo "PATH=$PATH"; echo "HOME=$HOME"' });
    expect(r.stdout).toMatch(/PATH=\/.+/);
    expect(r.stdout).toMatch(/HOME=\/.+/);
  }, 20_000);

  it("opt-in passEnvNames lets a caller include a specific variable", async () => {
    const s = new LocalSandbox();
    const r = await s.exec({
      command: "echo \"AWS=$AWS_ACCESS_KEY_ID\"",
      passEnvNames: ["AWS_ACCESS_KEY_ID"],
    });
    expect(r.stdout).toContain("AWS=__test-secret-AWS_ACCESS_KEY_ID__");
  }, 20_000);
});
