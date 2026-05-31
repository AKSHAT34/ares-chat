// Phase U09 — docker sandbox backend.
//
// Per-command ephemeral container. `docker run --rm` with:
//   - --network=none      (no outbound network — the agent can ping
//                          MCPs from outside the container, not from
//                          inside; the in-container shell talks only to
//                          its own filesystem)
//   - --tmpfs /work        (in-memory work dir, gone with the container)
//   - --workdir /work
//   - --memory 512m --cpus 1.0  (resource cap)
//   - --user 1000:1000     (non-root)
//   - read-only root with /tmp + /work writable
//
// Image defaults to `alpine:3.19`. Override via ARES_SANDBOX_IMAGE.
//
// We DON'T persist state across calls — every shell_exec is a fresh
// container. That trades convenience for safety: the sandbox is a true
// blast-radius bound, not a session.

import { spawn } from "node:child_process";
import { SandboxBackend } from "./base.js";

const DEFAULT_IMAGE = process.env.ARES_SANDBOX_IMAGE || "alpine:3.19";
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;

export class DockerSandbox extends SandboxBackend {
  get name() { return "docker"; }
  get description() { return `ephemeral container per command (image=${DEFAULT_IMAGE}, --network=none, tmpfs /work, 512m, 1 cpu, non-root)`; }

  async health() {
    try {
      const r = await runDockerCmd(["info", "--format", "{{.ServerVersion}}"], { timeout: 3000 });
      if (r.exitCode === 0 && r.stdout.trim()) {
        return { ok: true, info: `docker daemon up (server v${r.stdout.trim()})` };
      }
      return { ok: false, info: r.stderr.trim() || "docker info failed" };
    } catch (e) {
      return { ok: false, info: e.message };
    }
  }

  async exec({ command, timeout = DEFAULT_TIMEOUT_MS, abortSignal } = {}) {
    if (!command || typeof command !== "string") {
      throw new Error("docker sandbox: command is required");
    }
    // Build the docker run argv. Pass the user's command via stdin so
    // shell quoting issues are isolated to the container's shell.
    const args = [
      "run", "--rm", "-i",
      "--network", "none",
      "--memory", "512m",
      "--cpus", "1.0",
      "--user", "1000:1000",
      "--read-only",
      "--tmpfs", "/work:rw,size=64m",
      "--tmpfs", "/tmp:rw,size=16m",
      "--workdir", "/work",
      "--security-opt", "no-new-privileges",
      DEFAULT_IMAGE,
      "/bin/sh", "-c", command,
    ];
    return runDockerCmd(args, { timeout, abortSignal });
  }
}

function runDockerCmd(args, { timeout = DEFAULT_TIMEOUT_MS, abortSignal } = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const cap = 64 * 1024;
    child.stdout.on("data", (c) => { if (stdout.length < cap) stdout += c.toString("utf8"); });
    child.stderr.on("data", (c) => { if (stderr.length < cap) stderr += c.toString("utf8"); });
    const t = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch {}
      reject(new Error(`docker sandbox: timeout after ${timeout}ms`));
    }, timeout);
    const onAbort = () => {
      try { child.kill("SIGTERM"); } catch {}
      reject(Object.assign(new Error("docker sandbox: aborted"), { name: "AbortError" }));
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
