#!/usr/bin/env node
// Phase U07a — Ares CLI front-end.
//
// One binary, multiple subcommands. Direct in-process import of
// lib/agent.js + lib/llm/bedrock-driver.js + lib/mcp-client.js — no HTTP
// hop to ares-chat's Express server. The CLI runs its own ReAct loop
// against the same MCP catalog the server uses.
//
// Subcommands:
//   chat          — interactive TUI (default when no subcommand given)
//   model         — list available Bedrock models
//   tools         — list MCPs and tool counts
//   gateway       — Slack/Outlook gateway control (placeholder until U07c)
//   doctor        — full-system probe (placeholder until U18)
//   setup         — first-run config wizard (placeholder until U17)
//   kiro migrate  — import .kiro/* into ~/.ares/ (placeholder until U19)
//   help          — show this help
//
// Usage:
//   node bin/ares.js                         # default chat
//   node bin/ares.js chat                    # explicit chat
//   node bin/ares.js model                   # list models
//   node bin/ares.js tools                   # list MCPs
//   node bin/ares.js --help
//
// Implementation notes:
//   - argparse is a 30-line homegrown parser (lib/cli/argparse.js). No
//     dep on yargs/commander — the CLI is single-user, single-machine,
//     never invoked over the network.
//   - The chat TUI lives in lib/cli/chat-tui.jsx (rendered via ink).
//     The .jsx is run through Node 22's native JSX support — Node 22
//     can't strip JSX without a loader, so the file is plain .js using
//     React.createElement directly. Keeps the CLI zero-build.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../lib/cli/argparse.js";
import { runChatTui } from "../lib/cli/chat-tui.js";
import { runModelCommand } from "../lib/cli/model-command.js";
import { runToolsCommand } from "../lib/cli/tools-command.js";
import { runAcpServer } from "../lib/acp/server.js";
import { runSetupCommand } from "../lib/cli/setup-command.js";
import { runDoctorCli } from "../lib/doctor.js";
import { runKiroMigrateCli } from "../lib/cli/kiro-migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printHelp() {
  console.log(`Ares CLI — local Bedrock-Claude agent

Usage:
  ares [<command>] [options]

Commands:
  chat                Interactive chat TUI (default)
  model               List available Bedrock Claude models
  tools               List MCPs and active tools
  acp                 Run as ACP stdio JSON-RPC server (Kiro/Zed/VS Code)
  gateway             Slack/Outlook gateway control      (Phase U07c)
  doctor              Health probe across all subsystems (Phase U18)
  setup               First-run config wizard            (Phase U17)
  kiro migrate        Import ~/.kiro state into ~/.ares  (Phase U19)
  help                Show this help

Options:
  --model <id>        Override default Bedrock model
  --profile <name>    Override AWS profile (default: your-aws-profile)
  --workspace <dir>   Override workspace root
  --help              Show help

Env vars:
  AWS_PROFILE         (required) — must be able to invoke Bedrock
  ARES_MODEL_ID       Default Bedrock model id
  ARES_WORKSPACE      Default workspace root
  ARES_CONTEXT_ENGINE anchor | head-truncate
  ARES_PROMPT_CACHE   on | off | auto
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const { command, opts } = parseArgs(argv, {
    boolean: ["help", "version"],
    string: ["model", "profile", "workspace"],
  });

  if (opts.help || command === "help") {
    printHelp();
    return 0;
  }
  if (opts.version) {
    console.log("ares-chat 1.0.0 (CLI U07a)");
    return 0;
  }

  // Apply overrides via env so downstream lib/ modules pick them up.
  if (opts.profile) process.env.AWS_PROFILE = opts.profile;
  if (opts.workspace) process.env.ARES_WORKSPACE = opts.workspace;
  if (opts.model) process.env.ARES_MODEL_ID = opts.model;

  switch (command) {
    case undefined:
    case "":
    case "chat":
      return runChatTui(opts);
    case "model":
    case "models":
      return runModelCommand(opts);
    case "tools":
    case "mcps":
      return runToolsCommand(opts);
    case "acp":
      return runAcpServer();
    case "gateway":
      console.log("gateway: not yet implemented (Phase U07c)");
      return 1;
    case "doctor":
      return runDoctorCli();
    case "setup":
      return runSetupCommand(opts);
    case "kiro": {
      const sub = opts._[1];
      if (sub === "migrate") return runKiroMigrateCli(opts);
      console.error(`unknown kiro subcommand: ${sub}`);
      return 2;
    }
    default:
      console.error(`unknown command: ${command}`);
      printHelp();
      return 2;
  }
}

main().then((code) => process.exit(code || 0)).catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
