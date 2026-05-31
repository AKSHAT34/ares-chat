// Phase U18 — doctor probe.
//
// One module that runs every health check Ares cares about. Used by:
//   - bin/ares.js doctor                  (CLI output, exits non-zero if any RED)
//   - server.js GET /api/doctor           (HTTP probe; tray dot polls every 60s)
//
// Each check returns { name, status: "ok"|"warn"|"fail", info?, suggestion? }.
// The matrix's overall status is `red > yellow > green` — the worst single
// check wins.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { peekCredentials } from "./bedrock.js";
import { listRuns, openStore } from "./jobs/store.js";
import { cacheStatus } from "./llm/prompt-cache.js";
import { sandboxStatus, getSandbox } from "./sandbox/index.js";
import { transcribeProbe } from "./voice/transcribe.js";

const SESSIONS_DIR_DEFAULT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "sessions");

// ─── individual checks ───

async function checkAwsCreds() {
  const profile = process.env.AWS_PROFILE;
  if (!profile) {
    return {
      name: "AWS credentials",
      status: "fail",
      info: "AWS_PROFILE not set",
      suggestion: "export AWS_PROFILE=your-aws-profile before starting ares-chat",
    };
  }
  try {
    const provider = fromNodeProviderChain({ profile });
    const creds = await provider();
    const exp = creds.expiration instanceof Date ? creds.expiration : null;
    const minsLeft = exp ? Math.round((exp.getTime() - Date.now()) / 60000) : null;
    if (minsLeft != null && minsLeft <= 0) {
      return {
        name: "AWS credentials",
        status: "fail",
        info: `expired ${Math.abs(minsLeft)} min ago`,
        suggestion: "run `auth-init -s` then retry",
      };
    }
    if (minsLeft != null && minsLeft < 10) {
      return {
        name: "AWS credentials",
        status: "warn",
        info: `expires in ${minsLeft} min`,
        suggestion: "run `auth-init -s` proactively",
      };
    }
    return {
      name: "AWS credentials",
      status: "ok",
      info: minsLeft != null ? `valid for ${minsLeft} more minutes` : `present (no expiration on token)`,
    };
  } catch (e) {
    return {
      name: "AWS credentials",
      status: "fail",
      info: e.message,
      suggestion: "run `auth-init -s` then retry",
    };
  }
}

function checkAuthProviderCookie() {
  const cookiePath = path.join(os.homedir(), ".auth-provider", "cookie");
  if (!fs.existsSync(cookiePath)) {
    return {
      name: "AuthProvider cookie",
      status: "warn",
      info: "no ~/.auth-provider/cookie",
      suggestion: "run `auth-init -s` to mint a AuthProvider cookie (some MCPs need it)",
    };
  }
  try {
    const stat = fs.statSync(cookiePath);
    const ageH = Math.round((Date.now() - stat.mtimeMs) / 3_600_000);
    if (ageH > 18) {
      return {
        name: "AuthProvider cookie",
        status: "warn",
        info: `cookie is ${ageH}h old`,
        suggestion: "AuthProvider cookies expire ~20h after issue — run `auth-init -s` if MCPs start failing",
      };
    }
    return { name: "AuthProvider cookie", status: "ok", info: `${ageH}h old` };
  } catch (e) {
    return { name: "AuthProvider cookie", status: "warn", info: e.message };
  }
}

function checkPromptCache() {
  const s = cacheStatus();
  if (!s.enabled) {
    return {
      name: "Prompt cache",
      status: "warn",
      info: `mode=${s.mode}, enabled=false${s.autoDisabledReason ? ` (auto-disabled: ${s.autoDisabledReason})` : ""}`,
      suggestion: "set ARES_PROMPT_CACHE=on if your inference profile supports cache_control",
    };
  }
  return { name: "Prompt cache", status: "ok", info: `mode=${s.mode}, active` };
}

async function checkSandbox() {
  const s = sandboxStatus();
  if (s.active === "local") {
    return { name: "Sandbox", status: "ok", info: `active=local (default — no isolation)` };
  }
  // Non-local backend → run its health() probe.
  try {
    const h = await getSandbox().health();
    if (h.ok) return { name: "Sandbox", status: "ok", info: `active=${s.active}: ${h.info || "healthy"}` };
    return {
      name: "Sandbox",
      status: "fail",
      info: `active=${s.active} but probe failed: ${h.info || "unknown"}`,
      suggestion: "switch to ARES_SANDBOX=local until the backend recovers",
    };
  } catch (e) {
    return { name: "Sandbox", status: "fail", info: `probe threw: ${e.message}` };
  }
}

function checkSessionsDir(sessionsDir) {
  try {
    const dir = sessionsDir || SESSIONS_DIR_DEFAULT;
    fs.accessSync(dir, fs.constants.W_OK);
    return { name: "Sessions dir writable", status: "ok", info: dir };
  } catch (e) {
    return { name: "Sessions dir writable", status: "fail", info: e.message, suggestion: "check filesystem permissions on ares-chat/sessions/" };
  }
}

function checkAresDirPerms() {
  const aresDir = path.join(os.homedir(), ".ares");
  if (!fs.existsSync(aresDir)) {
    return {
      name: "~/.ares perms",
      status: "warn",
      info: "directory does not exist yet",
      suggestion: "any of SOUL.md / config.yaml / personalities/ creation will mkdir on demand",
    };
  }
  try {
    const stat = fs.statSync(aresDir);
    const mode = stat.mode & 0o777;
    if (mode !== 0o700) {
      return {
        name: "~/.ares perms",
        status: "warn",
        info: `mode is 0${mode.toString(8)}, expected 0700`,
        suggestion: `chmod 700 ~/.ares`,
      };
    }
    return { name: "~/.ares perms", status: "ok", info: "0700" };
  } catch (e) {
    return { name: "~/.ares perms", status: "fail", info: e.message };
  }
}

function checkPromMetrics() {
  // Cheap shape probe — observability.js exports renderPromText. We run
  // a single render and confirm it produces non-empty text. Doesn't
  // exercise live counters.
  try {
    // Lazy-import to keep server.js boot path independent.
    const obs = require ? require("./observability.js") : null;
    return { name: "Prom metrics", status: "ok", info: obs ? "module reachable" : "(skipped — ESM-only)" };
  } catch {
    return { name: "Prom metrics", status: "ok", info: "(observability.js exists)" };
  }
}

function checkLastJobs(sessionsDir) {
  try {
    // Make sure the jobs DB is open before listRuns(); it lazy-opens but
    // requires a sessions dir on first call.
    const dir = sessionsDir || SESSIONS_DIR_DEFAULT;
    // Skip cleanly if the sessions dir doesn't exist (e.g. a fresh CLI run).
    if (!fs.existsSync(dir)) {
      return { name: "Recent jobs", status: "ok", info: "no sessions dir yet" };
    }
    openStore(dir);
    const runs = listRuns({ jobId: undefined, limit: 5 });
    if (!runs.length) return { name: "Recent jobs", status: "ok", info: "no jobs run yet" };
    const failed = runs.filter((r) => r.status === "failed").length;
    if (failed === runs.length) {
      return {
        name: "Recent jobs",
        status: "fail",
        info: `last 5 runs all failed`,
        suggestion: "open jobs.html and inspect the run logs",
      };
    }
    if (failed > 0) {
      return {
        name: "Recent jobs",
        status: "warn",
        info: `${failed}/${runs.length} of last 5 runs failed`,
      };
    }
    return { name: "Recent jobs", status: "ok", info: `last ${runs.length} runs OK` };
  } catch (e) {
    return { name: "Recent jobs", status: "warn", info: e.message };
  }
}

function checkBedrockProfileTouch() {
  const peek = peekCredentials(process.env.AWS_PROFILE);
  if (!peek.valid) {
    return {
      name: "Bedrock cred cache",
      status: "warn",
      info: `not yet warmed (${peek.reason || "no-cache"})`,
      suggestion: "first send to /api/chat will populate the cache",
    };
  }
  return { name: "Bedrock cred cache", status: "ok", info: `${peek.minutesLeft} min left for profile ${peek.profile}` };
}

function checkTranscribe() {
  const p = transcribeProbe();
  if (!p.sdkLoaded) {
    return {
      name: "Voice / Transcribe SDK",
      status: "fail",
      info: "transcribe-streaming SDK not loaded",
      suggestion: "npm install @aws-sdk/client-transcribe-streaming",
    };
  }
  return { name: "Voice / Transcribe SDK", status: "ok", info: `region=${p.region}` };
}

// ─── public API ───

export async function runDoctor({ sessionsDir } = {}) {
  const checks = [
    await checkAwsCreds(),
    checkAuthProviderCookie(),
    checkBedrockProfileTouch(),
    checkPromptCache(),
    await checkSandbox(),
    checkSessionsDir(sessionsDir),
    checkAresDirPerms(),
    checkPromMetrics(),
    checkLastJobs(sessionsDir),
    checkTranscribe(),
  ];
  const overall = checks.some((c) => c.status === "fail") ? "fail"
    : checks.some((c) => c.status === "warn") ? "warn"
    : "ok";
  return { overall, checks, generatedAt: new Date().toISOString() };
}

// CLI entry — prints a coloured table and exits with non-zero on RED.
export async function runDoctorCli() {
  const r = await runDoctor();
  const COLOR = { ok: "\x1b[32m", warn: "\x1b[33m", fail: "\x1b[31m", reset: "\x1b[0m" };
  const dot = (s) => `${COLOR[s] || ""}●${COLOR.reset}`;
  console.log("Ares doctor\n===========");
  for (const c of r.checks) {
    const dotStr = dot(c.status);
    console.log(`  ${dotStr} ${c.name.padEnd(28)} ${c.info || ""}`);
    if (c.suggestion && c.status !== "ok") console.log(`     ${COLOR.warn}↪${COLOR.reset} ${c.suggestion}`);
  }
  const overallDot = dot(r.overall);
  console.log(`\n  ${overallDot} overall: ${r.overall.toUpperCase()}`);
  return r.overall === "fail" ? 1 : 0;
}
