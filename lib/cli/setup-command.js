// Phase U17 — `ares setup` wizard.
//
// Asks the user about: AWS profile, default Bedrock model, on-demand
// MCPs to enable in Tier-1 mode by default, Slack channel allowlist
// (gateway), Outlook folder allowlist (gateway). Verifies Bedrock
// reachability via a 1-token Haiku ping (uses the existing driver).
//
// Output: ~/.ares/config.yaml. Idempotent — re-running shows the
// current values and uses them as defaults.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { BedrockClaude } from "../llm/bedrock-driver.js";
import { listModels } from "../llm/model-registry.js";

const CONFIG_PATH = path.join(os.homedir(), ".ares", "config.yaml");

function ensureDir() {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
}

// ── tiny YAML emitter / parser (just enough for our flat config shape) ──
function emitYaml(obj, indent = 0) {
  const pad = " ".repeat(indent);
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      lines.push(`${pad}${k}: null`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${pad}${k}: []`);
      else {
        lines.push(`${pad}${k}:`);
        for (const item of v) lines.push(`${pad}  - ${typeof item === "string" ? JSON.stringify(item) : String(item)}`);
      }
    } else if (typeof v === "object") {
      lines.push(`${pad}${k}:`);
      lines.push(emitYaml(v, indent + 2));
    } else if (typeof v === "string") {
      // Quote if contains anything yaml-special
      const safe = /^[A-Za-z0-9_./@-]+$/.test(v) ? v : JSON.stringify(v);
      lines.push(`${pad}${k}: ${safe}`);
    } else if (typeof v === "boolean" || typeof v === "number") {
      lines.push(`${pad}${k}: ${v}`);
    } else {
      lines.push(`${pad}${k}: ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}

function parseYamlSimple(text) {
  // Whitespace-sensitive parser for the subset we emit. Two-pass-ish:
  // for a key with an empty value, we DON'T eagerly create a nested
  // object. Instead the next line decides: if it's `- item`, the key is
  // an array; if it's another `key: value` at deeper indent, the key is
  // a nested object. The stack carries the deepest-known key + the
  // indent at which it was declared.
  const out = {};
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  // Stack frames: { indent, target, pendingKey, pendingKeyIndent }
  // - target          → the object we're currently filling
  // - pendingKey      → key declared at this frame whose value-shape is
  //                     still undecided (next line picks: array vs object)
  // - pendingKeyIndent→ indent of the line that introduced the key
  let stack = [{ indent: -1, target: out, pendingKey: null, pendingKeyIndent: -1 }];
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.slice(indent);
    // Pop frames whose indent is no longer in scope. We pop only when
    // the current line is STRICTLY LESS indented than the frame's own
    // declaration indent — same indent means same frame (sibling key).
    while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];

    if (line.startsWith("- ")) {
      // Array element. Owner is the most recent pendingKey at a
      // shallower indent than this one.
      const v = parseScalar(line.slice(2));
      // Look up the stack for a frame with a pendingKey awaiting items.
      let owner = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].pendingKey != null && stack[i].pendingKeyIndent < indent) {
          owner = stack[i];
          break;
        }
      }
      if (!owner) continue;
      const key = owner.pendingKey;
      if (!Array.isArray(owner.target[key])) owner.target[key] = [];
      owner.target[key].push(v);
      continue;
    }

    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const [, key, valRaw] = m;

    // If we had a pending key whose shape was unresolved, treat it as
    // a nested object since the next thing we see is another `key: …`
    // at deeper indent.
    if (top.pendingKey != null && indent > top.pendingKeyIndent) {
      const childObj = {};
      top.target[top.pendingKey] = childObj;
      stack.push({ indent, target: childObj, pendingKey: null, pendingKeyIndent: -1 });
      top.pendingKey = null;
      // re-resolve top after push
    }
    const cur = stack[stack.length - 1];

    if (valRaw === "" || valRaw === null) {
      // Pending — next line will say if it's an array or an object.
      cur.target[key] = null; // tentative; gets replaced by [] or {}
      cur.pendingKey = key;
      cur.pendingKeyIndent = indent;
      continue;
    }
    if (valRaw === "[]") {
      cur.target[key] = [];
      cur.pendingKey = null;
      continue;
    }
    cur.target[key] = parseScalar(valRaw);
    cur.pendingKey = null;
  }
  // Replace any leftover pending nulls with empty objects (a key with
  // no children at all).
  function cleanup(o) {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      if (o[k] === null && Array.isArray(o[k]) === false) {
        // Leave actual nulls alone — only nullify if we know the key was
        // pending (we don't, so be conservative and trust the writer).
      } else if (typeof o[k] === "object" && !Array.isArray(o[k])) {
        cleanup(o[k]);
      }
    }
  }
  cleanup(out);
  return out;
}

function parseScalar(s) {
  s = s.trim();
  if (s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // Strip wrapping quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  return s;
}

// ── interactive prompt helpers ──
function ask(rl, prompt, defaultValue) {
  const suffix = defaultValue !== undefined && defaultValue !== "" ? ` [${defaultValue}]` : "";
  return new Promise((resolve) => {
    rl.question(`${prompt}${suffix}: `, (raw) => {
      const v = (raw || "").trim();
      if (!v && defaultValue !== undefined) return resolve(defaultValue);
      resolve(v);
    });
  });
}

function readExisting() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return parseYamlSimple(raw);
  } catch {
    return null;
  }
}

async function pingBedrock({ profile, modelId }) {
  process.env.AWS_PROFILE = profile || process.env.AWS_PROFILE;
  const bedrock = new BedrockClaude({
    modelId: modelId || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    region: process.env.AWS_REGION || "us-west-2",
    profile: profile || process.env.AWS_PROFILE,
  });
  const r = await bedrock.invoke({
    system: "Reply with a single word.",
    messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
    max_tokens: 1,
  });
  const text = r?.content?.find?.((c) => c.type === "text")?.text || "";
  return { ok: true, replyChars: text.length, model: modelId };
}

export async function runSetupCommand(_opts = {}) {
  ensureDir();
  const existing = readExisting();
  console.log("Ares setup wizard\n=================");
  if (existing) console.log(`(existing config at ${CONFIG_PATH} — values shown as defaults)\n`);
  else console.log(`(seeding new config at ${CONFIG_PATH})\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const get = (prompt, def) => ask(rl, prompt, def);

  try {
    const awsProfile = await get("AWS profile", existing?.aws_profile || process.env.AWS_PROFILE || "your-aws-profile");
    const region = await get("AWS region", existing?.aws_region || process.env.AWS_REGION || "us-west-2");

    console.log("\nAvailable Bedrock models:");
    for (const m of listModels()) console.log(`  - ${m.id}    (${m.name})`);
    const defaultModel = existing?.default_model || "us.anthropic.claude-sonnet-4-20250514";
    const model = await get("Default Bedrock model id", defaultModel);

    const onDemandRaw = await get(
      "On-demand MCPs to enable by default (comma-separated, leave blank for none)",
      (existing?.enabled_on_demand_mcps || []).join(", ")
    );
    const enabledMcps = onDemandRaw.split(",").map((s) => s.trim()).filter(Boolean);

    const slackChannelsRaw = await get(
      "Gateway: Slack channel allowlist (comma-separated channel ids)",
      (existing?.gateway?.slack_channels || []).join(", ")
    );
    const slackChannels = slackChannelsRaw.split(",").map((s) => s.trim()).filter(Boolean);

    const outlookFoldersRaw = await get(
      "Gateway: Outlook folder allowlist (comma-separated folder names)",
      (existing?.gateway?.outlook_folders || []).join(", ")
    );
    const outlookFolders = outlookFoldersRaw.split(",").map((s) => s.trim()).filter(Boolean);

    const config = {
      aws_profile: awsProfile,
      aws_region: region,
      default_model: model,
      enabled_on_demand_mcps: enabledMcps,
      gateway: {
        slack_channels: slackChannels,
        outlook_folders: outlookFolders,
      },
      written_at: new Date().toISOString(),
    };

    // Write before the connectivity probe — even if AWS is down the user
    // gets a saved config to fix later.
    fs.writeFileSync(CONFIG_PATH, emitYaml(config) + "\n", { mode: 0o600 });
    console.log(`\n✓ Saved ${CONFIG_PATH}`);

    console.log("\nVerifying Bedrock connectivity (1-token Haiku ping)…");
    try {
      const probe = await pingBedrock({ profile: awsProfile, modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0" });
      console.log(`✓ Bedrock reachable (Haiku replied with ${probe.replyChars} chars)\n`);
    } catch (e) {
      console.log(`✗ Bedrock probe failed: ${e.message}`);
      console.log("  Run `auth-init -s` (or your isengard refresh) and re-run `ares setup`.\n");
    }

    console.log("Setup complete. Restart ares-chat (launchctl kickstart -k gui/$UID/com.ares-chat) to pick up the new defaults.");
    return 0;
  } finally {
    rl.close();
  }
}

// Exposed for test harnesses that want to invoke parsing/emitting without
// the interactive layer.
export const _yaml = { emit: emitYaml, parse: parseYamlSimple };
export function getConfigPath() { return CONFIG_PATH; }
