// Phase U09 — local sandbox backend (passthrough).
//
// Spawns the command via /bin/zsh -c, no isolation. Default backend.
// The `local` backend is what existing ares-chat behaviour uses today —
// shipping it via this abstraction is a refactor, not a feature change.

import { spawn } from "node:child_process";
import { SandboxBackend } from "./base.js";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// E-9: minimal env passed to the spawned shell. Pre-fix `env: process.env`
// inherited the entire parent environment including AWS_*, ARES_*, and
// the bearer token if it ever ended up exported. An adversarial tool
// result that convinced the agent to run `env > /tmp/leak` would exfil
// everything. Pass only the variables the shell genuinely needs to
// resolve a normal command. Opt-in expansion can be done at call time
// via opts.passEnvNames.
const _DEFAULT_PASSTHROUGH_ENV = ["PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "TERM"];
function _buildSandboxEnv(passEnvNames = []) {
  const out = {};
  const allow = new Set([..._DEFAULT_PASSTHROUGH_ENV, ...passEnvNames]);
  for (const k of allow) {
    if (k in process.env) out[k] = process.env[k];
  }
  return out;
}

export class LocalSandbox extends SandboxBackend {
  get name() { return "local"; }
  get description() { return "minimal-env passthrough — runs commands directly on the host shell"; }

  async exec({ command, cwd, timeout = DEFAULT_TIMEOUT_MS, abortSignal, passEnvNames } = {}) {
    if (!command || typeof command !== "string") {
      throw new Error("local sandbox: command is required");
    }
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const child = spawn("/bin/zsh", ["-c", command], {
        cwd: cwd || process.env.HOME,
        env: _buildSandboxEnv(passEnvNames),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const cap = 64 * 1024;
      child.stdout.on("data", (c) => { if (stdout.length < cap) stdout += c.toString("utf8"); });
      child.stderr.on("data", (c) => { if (stderr.length < cap) stderr += c.toString("utf8"); });
      const t = setTimeout(() => {
        try { child.kill("SIGTERM"); } catch {}
        reject(new Error(`local sandbox: timeout after ${timeout}ms`));
      }, timeout);
      const onAbort = () => {
        try { child.kill("SIGTERM"); } catch {}
        reject(Object.assign(new Error("local sandbox: aborted"), { name: "AbortError" }));
      };
      if (abortSignal) {
        if (abortSignal.aborted) return onAbort();
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }
      child.on("error", (err) => {
        clearTimeout(t);
        if (abortSignal) abortSignal.removeEventListener?.("abort", onAbort);
        reject(err);
      });
      child.on("exit", (code) => {
        clearTimeout(t);
        if (abortSignal) abortSignal.removeEventListener?.("abort", onAbort);
        resolve({
          stdout: stdout.slice(0, cap),
          stderr: stderr.slice(0, cap),
          exitCode: typeof code === "number" ? code : 1,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }
}
