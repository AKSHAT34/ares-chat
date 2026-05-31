// `ares tools` — list MCP catalog with state. Spawns Tier 1 to enumerate
// tools, then prints one row per server.

import path from "node:path";
import os from "node:os";
import { McpHub } from "../mcp-client.js";

export async function runToolsCommand(opts = {}) {
  const workspace = opts.workspace || process.env.ARES_WORKSPACE || path.join(os.homedir(), "Documents", "Cline");
  const mcpJsonPath = path.join(workspace, ".kiro", "settings", "mcp.json");

  const hub = new McpHub({ mcpJsonPath, log: () => {} });
  console.log(`Loading MCP catalog from ${mcpJsonPath}…`);
  try {
    await hub.start();
  } catch (e) {
    console.error(`Failed to start MCP hub: ${e.message}`);
    return 1;
  }

  const list = hub.listServers();
  const running = list.filter((s) => s.active);
  const idle = list.filter((s) => !s.active);

  console.log("");
  console.log(`Tier 1 active (${running.length}):`);
  for (const s of running) {
    console.log(`  • ${s.name.padEnd(36)} ${String(s.toolCount).padStart(3)} tools  ${s.description || ""}`);
  }

  console.log("");
  console.log(`On-demand catalog (${idle.length}):`);
  for (const s of idle) {
    console.log(`  ◦ ${s.name.padEnd(36)} ${(s.description || "").slice(0, 80)}`);
  }
  console.log("");
  console.log(`Total: ${list.length} servers, ${list.reduce((n, s) => n + s.toolCount, 0)} tools cataloged.`);

  // Tier 1 servers stay open after this exits — keeping the spawn-cost low for
  // a follow-up `ares chat`. process.exit triggers the children to clean up.
  return 0;
}
