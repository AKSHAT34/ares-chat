// Deterministic, read-only diagnostic checks for the debug-bot.
//
// Each check is an async fn returning { layer, findings: Finding[] }.
// A Finding = { layer, severity, title, detail, file?, risk }.
// Checks NEVER mutate the codebase — detection and remediation are
// strictly separated (the fixer module owns writes). They run
// sequentially in the order exported by ALL_CHECKS so the layers are
// scanned "one by one" as requested.
//
// Paths are resolved relative to the repo roots, not cwd, so the bot
// works no matter where the server process was launched from.

import { promisify } from "node:util";
import { execFile as _execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const execFile = promisify(_execFile);

const KIRO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname), "..", ".."
); // project root
const ARES_CHAT = KIRO_ROOT;
const ARES_UI = path.join(KIRO_ROOT, "..", "ares-ui");

const RISKY_FILES = ["server.js", "lib/agent.js", "lib/mcp-client.js", "lib/jobs/runner.js"];

function classifyRisk(file) {
  if (!file) return "risky"; // unknown blast radius → treat as risky
  const rel = file.replace(ARES_CHAT + "/", "").replace(ARES_UI + "/", "");
  if (RISKY_FILES.some((r) => rel === r || rel.endsWith("/" + r))) return "risky";
  return "safe";
}

async function run(cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await execFile(cmd, args, {
      cwd: opts.cwd, timeout: opts.timeout ?? 120000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
    });
    return { ok: true, code: 0, stdout: stdout || "", stderr: stderr || "" };
  } catch (e) {
    return {
      ok: false,
      code: e.code ?? 1,
      stdout: e.stdout || "",
      stderr: e.stderr || (e.message || ""),
      timedOut: e.killed === true || /timed out/i.test(e.message || ""),
    };
  }
}

// ── 1. Logs ──────────────────────────────────────────────────────────
// Scan the tail of the server's stdout/stderr logs for fresh errors.
export async function checkLogs() {
  const findings = [];
  const logs = ["/tmp/ares-chat.err.log", "/tmp/ares-chat.out.log"];
  const ERROR_RE = /(Error:|Uncaught|UnhandledPromiseRejection|ECONNREFUSED|TypeError|ReferenceError|SyntaxError|EADDRINUSE|FATAL|\bstack trace\b)/i;
  // Exclude expected operational noise: agent tool failures echoed to the log
  // (e.g. "[tool-error] shell-agent__…: Command failed") are normal runtime
  // events, NOT server faults. Also skip log lines that merely quote an error
  // string inside a JSON payload / our own debug-bot finding detail.
  const IGNORE_RE = /\[tool-error\]|\[tool\]|shell-agent__|debug-bot|debugbot|"detail":|Command failed: cd/i;
  // Only flag errors within the last hour so we don't resurrect ancient noise.
  for (const lf of logs) {
    let txt;
    try {
      const stat = fs.statSync(lf);
      const cap = 512 * 1024;
      if (stat.size <= cap) txt = fs.readFileSync(lf, "utf8");
      else {
        const fd = fs.openSync(lf, "r");
        const buf = Buffer.alloc(cap);
        fs.readSync(fd, buf, 0, cap, stat.size - cap);
        fs.closeSync(fd);
        txt = buf.toString("utf8");
      }
    } catch { continue; }
    const lines = txt.split("\n");
    const recent = lines.slice(-400);
    const hits = recent.filter((l) => ERROR_RE.test(l) && !IGNORE_RE.test(l));
    // Group identical error signatures so we raise one finding per signature.
    const bySig = new Map();
    for (const l of hits) {
      const sig = l.replace(/\d{4}-\d{2}-\d{2}T[\d:.Z]+/g, "")
                   .replace(/0x[0-9a-f]+/gi, "")
                   .replace(/:\d+:\d+/g, "")
                   .trim()
                   .slice(0, 160);
      if (!sig) continue;
      bySig.set(sig, (bySig.get(sig) || 0) + 1);
    }
    for (const [sig, count] of bySig) {
      findings.push({
        layer: "logs",
        severity: /FATAL|Uncaught|UnhandledPromise|EADDRINUSE/i.test(sig) ? "high" : "medium",
        title: `Runtime error in ${path.basename(lf)}: ${sig.slice(0, 80)}`,
        detail: `Seen ${count}× in the last 400 log lines of ${lf}:\n${sig}`,
        file: null,
        risk: "risky", // log-driven fixes always need a human to trace root cause
      });
    }
  }
  return { layer: "logs", findings };
}

// ── 2. Backend syntax (node scripts/check.mjs) ────────────────────────
export async function checkBackendSyntax() {
  const r = await run("node", ["scripts/check.mjs"], { cwd: ARES_CHAT, timeout: 60000 });
  const findings = [];
  if (!r.ok) {
    const out = (r.stderr + "\n" + r.stdout).trim();
    // Try to pull a file path out of the output.
    const fileMatch = out.match(/([\w./-]+\.(?:js|mjs|ts)):(\d+)/);
    const file = fileMatch ? path.join(ARES_CHAT, fileMatch[1]) : null;
    findings.push({
      layer: "backend",
      severity: "critical",
      title: `Backend syntax check failed${fileMatch ? ` in ${fileMatch[1]}` : ""}`,
      detail: out.slice(0, 2000),
      file,
      risk: file ? classifyRisk(file) : "risky",
    });
  }
  return { layer: "backend", findings };
}

// ── 3. Backend tests (vitest) ─────────────────────────────────────────
export async function checkBackendTests() {
  const r = await run("npm", ["test", "--silent"], { cwd: ARES_CHAT, timeout: 180000 });
  const findings = [];
  if (!r.ok && !r.timedOut) {
    const out = (r.stdout + "\n" + r.stderr);
    // Count failed tests; surface the first few failing file names.
    const failFiles = [...out.matchAll(/(?:FAIL|❯)\s+([\w./-]+\.test\.[jt]s)/g)]
      .map((m) => m[1]);
    const uniqFiles = [...new Set(failFiles)].slice(0, 6);
    const failCount = (out.match(/(\d+) failed/) || [])[1] || "?";
    findings.push({
      layer: "tests",
      severity: "high",
      title: `${failCount} backend test(s) failing`,
      detail: (uniqFiles.length ? `Failing files:\n- ${uniqFiles.join("\n- ")}\n\n` : "") +
              out.slice(-1800),
      file: uniqFiles.length === 1 ? path.join(ARES_CHAT, uniqFiles[0]) : null,
      risk: "safe", // a single failing test is usually a safe, scoped fix
    });
  } else if (r.timedOut) {
    findings.push({
      layer: "tests",
      severity: "medium",
      title: "Backend test run timed out (>180s)",
      detail: "Test suite did not finish within the wallclock budget. Possible hang or runaway test.",
      file: null,
      risk: "risky",
    });
  }
  return { layer: "tests", findings };
}

// ── 4. Frontend typecheck (tsc -b --noEmit) ───────────────────────────
export async function checkFrontendTypes() {
  const r = await run("npx", ["tsc", "-b", "--noEmit"], { cwd: ARES_UI, timeout: 180000 });
  const findings = [];
  if (!r.ok && !r.timedOut) {
    const out = (r.stdout + "\n" + r.stderr);
    // tsc emits "path(line,col): error TSxxxx: message"
    const errs = [...out.matchAll(/([\w./-]+\.ts)\((\d+),(\d+)\): error (TS\d+): (.+)/g)];
    if (errs.length === 0) {
      findings.push({
        layer: "frontend",
        severity: "high",
        title: "Frontend typecheck failed",
        detail: out.slice(0, 2000),
        file: null,
        risk: "risky",
      });
    } else {
      // One finding per distinct file (cap 8) so cards map to fixable units.
      const byFile = new Map();
      for (const e of errs) {
        const f = e[1];
        if (!byFile.has(f)) byFile.set(f, []);
        byFile.get(f).push(`${e[2]}:${e[3]} ${e[4]} ${e[5]}`);
      }
      let n = 0;
      for (const [f, msgs] of byFile) {
        if (n++ >= 8) break;
        findings.push({
          layer: "frontend",
          severity: "high",
          title: `TypeScript error${msgs.length > 1 ? "s" : ""} in ${f}`,
          detail: msgs.slice(0, 12).join("\n"),
          file: path.join(ARES_UI, f),
          risk: classifyRisk(path.join(ARES_UI, f)),
        });
      }
    }
  }
  return { layer: "frontend", findings };
}

// ── 5. Frontend build (vite) ──────────────────────────────────────────
export async function checkFrontendBuild() {
  const r = await run("npm", ["run", "build", "--silent"], { cwd: ARES_UI, timeout: 240000 });
  const findings = [];
  if (!r.ok && !r.timedOut) {
    const out = (r.stdout + "\n" + r.stderr);
    const fileMatch = out.match(/([\w./-]+\.ts)/);
    findings.push({
      layer: "frontend",
      severity: "critical",
      title: "Frontend build (vite) failed",
      detail: out.slice(-2000),
      file: fileMatch ? path.join(ARES_UI, fileMatch[1]) : null,
      risk: "risky",
    });
  }
  return { layer: "frontend", findings };
}

// ── 6. UI/UX heuristics (static, cheap) ───────────────────────────────
// Catches a class of regressions that compile fine but break UX: hardcoded
// colors bypassing the theme tokens, raw px font sizes, accessibility gaps.
export async function checkUiUx() {
  const findings = [];
  const featuresDir = path.join(ARES_UI, "src", "features");
  const files = walkTs(featuresDir).slice(0, 400);
  let hardcodedHexCount = 0;
  const offenders = [];
  for (const f of files) {
    let txt;
    try { txt = fs.readFileSync(f, "utf8"); } catch { continue; }
    // Hardcoded hex colors inside css`` blocks (rough heuristic): a #rrggbb
    // that isn't part of a var() fallback comment. Skip if file already uses
    // var(--…) heavily (likely intentional one-offs).
    const hexes = txt.match(/#[0-9a-fA-F]{6}\b/g) || [];
    const varUses = (txt.match(/var\(--/g) || []).length;
    if (hexes.length >= 4 && varUses < hexes.length) {
      hardcodedHexCount += hexes.length;
      offenders.push(`${path.relative(ARES_UI, f)} (${hexes.length} hex literals)`);
    }
  }
  if (offenders.length > 0) {
    findings.push({
      layer: "ui-ux",
      severity: "low",
      title: `Hardcoded colors bypassing theme tokens in ${offenders.length} component(s)`,
      detail: `Prefer var(--…) design tokens so dark/light themes stay consistent.\n` +
              offenders.slice(0, 12).join("\n"),
      file: null,
      risk: "safe",
    });
  }
  return { layer: "ui-ux", findings };
}

// ── 7. Architecture heuristics (static) ───────────────────────────────
// Flags drift that erodes maintainability: oversized monolith files,
// TODO/FIXME/HACK debt markers, and console.log left in shipped backend.
export async function checkArchitecture() {
  const findings = [];

  // 7a. Oversized source files (> 2500 LOC) — refactor candidates.
  const roots = [
    { dir: path.join(ARES_CHAT, "lib"), base: ARES_CHAT },
    { dir: path.join(ARES_UI, "src"), base: ARES_UI },
  ];
  for (const { dir, base } of roots) {
    for (const f of walkTs(dir, [".js", ".ts"])) {
      let lines;
      try { lines = fs.readFileSync(f, "utf8").split("\n").length; } catch { continue; }
      if (lines > 2500) {
        findings.push({
          layer: "architecture",
          severity: "low",
          title: `Oversized file: ${path.relative(base, f)} (${lines} LOC)`,
          detail: `Files over 2500 LOC are hard to review and test. Consider splitting ${path.relative(base, f)} into focused modules.`,
          file: f,
          risk: "risky", // splitting a monolith is never a blind auto-fix
        });
      }
    }
  }

  // 7b. Debt markers across the backend lib.
  try {
    const r = await run("grep", ["-rIn", "-E", "TODO|FIXME|HACK|XXX", "lib", "--include=*.js"], { cwd: ARES_CHAT, timeout: 30000 });
    const count = (r.stdout || "").split("\n").filter(Boolean).length;
    if (count >= 25) {
      findings.push({
        layer: "architecture",
        severity: "low",
        title: `${count} unresolved debt markers (TODO/FIXME/HACK) in backend lib`,
        detail: `High debt-marker density. Triage and convert the actionable ones into tracked findings.`,
        file: null,
        risk: "risky",
      });
    }
  } catch {}

  return { layer: "architecture", findings };
}

// Ordered list — this IS the "check one by one" sequence.
export const ALL_CHECKS = [
  { id: "logs",         fn: checkLogs },
  { id: "backend",      fn: checkBackendSyntax },
  { id: "tests",        fn: checkBackendTests },
  { id: "frontend-ts",  fn: checkFrontendTypes },
  { id: "frontend-build", fn: checkFrontendBuild },
  { id: "ui-ux",        fn: checkUiUx },
  { id: "architecture", fn: checkArchitecture },
];

// ── helpers ───────────────────────────────────────────────────────────
function walkTs(dir, exts = [".ts"]) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      out.push(...walkTs(full, exts));
    } else if (exts.some((x) => e.name.endsWith(x)) && !e.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

export { classifyRisk, ARES_CHAT, ARES_UI };
