// Debug-bot fixer. Given a finding classified `risk: "safe"`, attempts a
// scoped, reversible fix:
//
//   1. Snapshot the target file to a .bak (file-level backup — the repo has
//      no git commits to revert against).
//   2. Ask a focused agent to produce the FULL corrected file contents.
//   3. Write them, re-run the layer's verifier.
//   4. If green → keep (status auto_fixed). If red → restore .bak (status
//      reverted) so we never leave the tree worse than we found it.
//
// `risk: "risky"` findings are NEVER auto-applied here. The handler routes
// them to needs_user with a proposed change description instead.

import fs from "node:fs";
import { promisify } from "node:util";
import { execFile as _execFile } from "node:child_process";
import { Agent } from "../agent.js";
import { ARES_CHAT, ARES_UI } from "./checks.js";

const execFile = promisify(_execFile);

async function run(cmd, args, cwd, timeout = 180000) {
  try {
    await execFile(cmd, args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" } });
    return { ok: true };
  } catch (e) {
    return { ok: false, out: ((e.stdout || "") + "\n" + (e.stderr || e.message || "")).slice(-1500) };
  }
}

// Re-run only the verifier relevant to the finding's layer so a fix is
// validated cheaply rather than re-running the whole sweep.
async function verifyLayer(layer) {
  switch (layer) {
    case "backend":
      return run("node", ["scripts/check.mjs"], ARES_CHAT, 60000);
    case "tests":
      return run("npm", ["test", "--silent"], ARES_CHAT, 180000);
    case "frontend":
      // typecheck is the fast gate; build is implied green if types pass for
      // the lit/vite setup, but we run both to be safe on build-layer fixes.
      { const t = await run("npx", ["tsc", "-b", "--noEmit"], ARES_UI, 180000);
        if (!t.ok) return t;
        return run("npm", ["run", "build", "--silent"], ARES_UI, 240000); }
    default:
      // ui-ux / architecture / logs have no compile gate; treat as pass so
      // the change at least has to survive a backend syntax check below.
      return { ok: true };
  }
}

/**
 * @returns { applied: boolean, status: "auto_fixed"|"reverted"|"skipped",
 *            summary: string }
 */
export async function attemptFix({ finding, bedrockFactory, hub, systemPrompt, log }) {
  if (finding.risk !== "safe") {
    return { applied: false, status: "skipped", summary: "risky finding — routed to needs_user" };
  }
  const file = finding.file;
  if (!file || !fs.existsSync(file)) {
    return { applied: false, status: "skipped", summary: "no concrete target file to edit" };
  }

  const original = fs.readFileSync(file, "utf8");
  const bak = file + ".debugbot.bak";

  // Build a tight prompt: the agent gets the file + the finding and must
  // return ONLY the corrected full file between sentinels. No tool use.
  const prompt = [
    `You are fixing a single, scoped bug. Output the COMPLETE corrected file — nothing else.`,
    `Do not refactor unrelated code. Make the smallest change that resolves the finding.`,
    ``,
    `FINDING (${finding.severity}/${finding.layer}): ${finding.title}`,
    `DETAIL:\n${(finding.detail || "").slice(0, 1500)}`,
    ``,
    `FILE: ${file}`,
    `----- BEGIN CURRENT FILE -----`,
    original.slice(0, 60000),
    `----- END CURRENT FILE -----`,
    ``,
    `Respond with the corrected file wrapped exactly as:`,
    `<<<FIXED_FILE>>>`,
    `(full corrected contents)`,
    `<<<END_FIXED_FILE>>>`,
  ].join("\n");

  const bedrock = bedrockFactory("us.anthropic.claude-sonnet-4-20250514");
  const agent = new Agent({
    bedrock, hub, systemPrompt: systemPrompt || "",
    // No tools — pure transform. Deny everything if the model tries.
    approvalGate: async () => ({ deny: true, reason: "fixer is text-only" }),
  });

  let reply = "";
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 120000);
  try {
    for await (const ev of agent.run(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      { abortSignal: abort.signal },
    )) {
      if (ev?.type === "text_delta" && typeof ev.text === "string") reply += ev.text;
    }
  } catch (e) {
    log?.("warn", `fixer agent errored: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  const m = reply.match(/<<<FIXED_FILE>>>\n?([\s\S]*?)\n?<<<END_FIXED_FILE>>>/);
  if (!m) {
    return { applied: false, status: "skipped", summary: "fixer produced no usable patch" };
  }
  const fixed = m[1];
  if (fixed.trim() === original.trim()) {
    return { applied: false, status: "skipped", summary: "fixer returned an identical file" };
  }
  // Guard against truncation: a fix that's <40% of the original size is
  // almost certainly a partial / clipped response — never write it.
  if (fixed.length < original.length * 0.4) {
    return { applied: false, status: "skipped", summary: "fixer output suspiciously short — refused to write" };
  }

  // Snapshot → write → verify.
  fs.writeFileSync(bak, original, "utf8");
  fs.writeFileSync(file, fixed, "utf8");
  log?.("info", `fixer wrote candidate to ${file}, verifying layer=${finding.layer}`);

  // Always run the backend syntax gate first as a cheap global sanity check,
  // then the layer-specific verifier.
  const syntax = await run("node", ["scripts/check.mjs"], ARES_CHAT, 60000);
  const layerCheck = syntax.ok ? await verifyLayer(finding.layer) : syntax;

  if (layerCheck.ok) {
    fs.rmSync(bak, { force: true });
    return { applied: true, status: "auto_fixed",
             summary: `Auto-fixed ${finding.title} — verification passed.` };
  }
  // Revert.
  fs.writeFileSync(file, original, "utf8");
  fs.rmSync(bak, { force: true });
  log?.("warn", `fixer reverted ${file} — verification failed: ${(layerCheck.out || "").slice(0, 200)}`);
  return { applied: false, status: "reverted",
           summary: `Attempted fix for "${finding.title}" failed verification and was reverted.` };
}
