// Q-pass-4 work-stream A — token-budget regression test.
//
// Locks in three properties:
//
//   1. With a fresh session (no messages) + the full 49-MCP catalog
//      worth of tool schemas (~530 tools), the prompt assembly + tool
//      cap path keeps the total under TOKEN_BEDROCK_SAFE_MAX (195K).
//
//   2. The agent's Tier-1 list survives the cap regardless of pressure.
//      Dropping memory or shell-agent would break the routing ladder —
//      we never want to do that automatically.
//
//   3. With a forced 250K-token transcript, the preflight path fires
//      `tools_capped` (the schema cut) AND `context_compressed` (the
//      transcript cut) before falling through to `preflight_too_large`.
//
// The test is hermetic — it stubs the hub, bedrock driver, and steering
// dirs so it can't depend on the live Bedrock account or `~/.kiro/`.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Agent, TIER1_MCPS } from "../lib/agent.js";
import {
  buildSystemPrompt,
  buildSystemPromptDetailed,
  getSystemPromptCaps,
} from "../lib/system-prompt.js";

// 49 MCP names from lib/mcp-client.js ALWAYS_ACTIVE_DEFAULTS — the
// catalog projection keeps them in declaration order. We don't import
// the constant directly because the hub module wires up child_process
// at load time; we'd rather avoid that side effect in tests.
const ALL_MCPS = [
  "memory", "skills", "shell-agent", "filesystem-agent", "ares-actions",
  "computer-use", "wiki-mcp", "email-mcp",
  "chrome-real", "kiro-browser-agent", "mac-apps", "data-query-mcp", "chat-mcp",
  "example-mcp", "example-mcp-na", "example-mcp-eu", "example-mcp-fe",
  "catalog-tapestry-mcp", "goals-goalmanagement-ro-mcp",
  "goals-metrics-ro-prod-na-mcp", "goals-recommendation-backend-service-ro-prod-mcp",
  "smart-retail-mcp", "smart-retail-agentic-mcp", "rbs-ripple-test2-mcp",
  "example-integration-mcp", "example-email-service-mcp",
  "aa-hydra-db-mcp", "contra-cogs-management-service-mcp",
  "contra-cogs-search-service-mcp", "vendorleadtimecoralservice-mcp",
  "oosp-procurability2-service-mcp", "procurability-mcp",
  "abadataservice-mcp", "associates-reporting-service-mcp",
  "ascent-ai-account-manager-mcp", "argoretailservice-mcp",
  "eu-scp-agent-prototype-mcp", "euscp-agent-proxy-service-mcp",
  "supplier-genie-mcp", "demandforecastservice-prod-mcp",
  "specialist-super-agent-mcp", "catalog-tapestry-tools-mcp",
  "catalog-tapestry-domain-mcp", "skumaster-internal-mcp",
  "awdinboundshipmentvisibilityservice-mcp", "geist-prism-mcp",
  "vioes-gateway-mcp", "dashboard-mcp", "pageindex-mcp",
];

// Synthesize a representative tool: a JSON schema with several
// realistic fields + descriptions. Each tool ≈ 1.2 KB JSON when
// serialized — close to the real catalog's per-tool footprint.
function makeFakeTool(serverName, idx) {
  return {
    name: `${serverName}__tool_${idx}`,
    description: `Tool ${idx} provided by ${serverName}. ` +
      "Performs a representative read or mutation against the upstream service. " +
      "Honours abortSignal and rate limits. Inputs validated against JSON schema below.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "the resource identifier or query string" },
        limit: { type: "integer", minimum: 1, maximum: 1000, description: "max rows" },
        offset: { type: "integer", minimum: 0, description: "pagination offset" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              op: { type: "string", enum: ["=", "!=", ">", "<", "in"] },
              value: { type: "string" },
            },
          },
          description: "list of equality / range filters",
        },
        options: {
          type: "object",
          properties: {
            verbose: { type: "boolean" },
            dryRun: { type: "boolean" },
            region: { type: "string", enum: ["NA", "EU", "FE", "beta", "gamma"] },
          },
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  };
}

function buildFakeCatalogTools({ toolsPerServer = 11 } = {}) {
  const out = [];
  for (const server of ALL_MCPS) {
    for (let i = 0; i < toolsPerServer; i++) {
      out.push(makeFakeTool(server, i));
    }
  }
  return out;
}

function makeHub(tools) {
  return {
    getClaudeTools: () => tools,
    getActiveServers: () => [],
    getCatalogForPrompt: () => "# MCP Catalog\n" + ALL_MCPS.map((m) => `- ${m}`).join("\n"),
    callTool: async () => ({ isError: true, content: [{ type: "text", text: "stub" }] }),
  };
}

// Steering scaffold so buildSystemPrompt finds a non-empty workspace
// dir AND a user dir. We point both at temp paths via the workspaceRoot
// param (workspace) + ARES_PERSONA_DIR (persona files) + HOME override
// (steering user dir). The user-level steering dir is only read by
// system-prompt.js when os.homedir() points at a dir containing
// .kiro/steering/, so we override HOME for the duration of the test.
let TMP_ROOT;
let prevHome;
let prevPersona;
beforeAll(() => {
  TMP_ROOT = path.join(tmpdir(), `ares-q-token-budget-${Date.now()}`);
  mkdirSync(TMP_ROOT, { recursive: true });

  // Workspace steering — three medium files so steering cap matters.
  const wsDir = path.join(TMP_ROOT, "workspace", ".kiro", "steering");
  mkdirSync(wsDir, { recursive: true });
  writeFileSync(path.join(wsDir, "a.md"), "# A\n" + "alpha line\n".repeat(2000));
  writeFileSync(path.join(wsDir, "b.md"), "# B\n" + "bravo line\n".repeat(2000));

  // User steering — one big file so the distributor truncates the
  // largest first.
  const userKiro = path.join(TMP_ROOT, "home", ".kiro", "steering");
  mkdirSync(userKiro, { recursive: true });
  writeFileSync(path.join(userKiro, "big.md"), "# Big\n" + "charlie line\n".repeat(8000));

  // Persona dir — empty stub seeds.
  const personaDir = path.join(TMP_ROOT, "ares");
  mkdirSync(personaDir, { recursive: true });
  prevPersona = process.env.ARES_PERSONA_DIR;
  process.env.ARES_PERSONA_DIR = personaDir;

  prevHome = process.env.HOME;
  process.env.HOME = path.join(TMP_ROOT, "home");
});
afterAll(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevPersona === undefined) delete process.env.ARES_PERSONA_DIR;
  else process.env.ARES_PERSONA_DIR = prevPersona;
  try { rmSync(TMP_ROOT, { recursive: true, force: true }); } catch {}
});

describe("Q-pass-4 work-stream A — token-budget runaway is fixed", () => {
  it("fresh session with 49 MCPs ≈ 530 tools fits under 195K total", async () => {
    const tools = buildFakeCatalogTools({ toolsPerServer: 11 }); // 49 * 11 = 539 tools
    expect(tools.length).toBeGreaterThanOrEqual(500);

    // Build the system prompt as the boot path would.
    const { prompt, breakdown } = await buildSystemPromptDetailed({
      workspaceRoot: path.join(TMP_ROOT, "workspace"),
      mcpCatalog: "# MCP Catalog\n" + ALL_MCPS.map((m) => `- ${m}`).join("\n"),
      log: () => {},
    });

    // Per-layer caps respected.
    const caps = getSystemPromptCaps();
    expect(breakdown.persona.tokens).toBeLessThanOrEqual(caps.persona);
    expect(breakdown.steering.tokens).toBeLessThanOrEqual(caps.steering);

    // Run _capTools to fit the schema list under the budget.
    const hub = makeHub(tools);
    const agent = new Agent({ bedrock: null, hub, systemPrompt: prompt });
    const cap = agent._capTools(tools, 80000);
    expect(cap.fittedUnderBudget).toBe(true);
    expect(cap.kept.length).toBeGreaterThan(0);

    // Total prompt tokens (system + tools + transcript=0) under 195K.
    const sysTokens = Math.ceil(prompt.length / 2.6);
    const toolTokens = Math.ceil(cap.jsonChars / 2.6);
    const total = sysTokens + toolTokens;
    expect(total).toBeLessThanOrEqual(195000);
  });

  it("Tier-1 MCPs always survive _capTools regardless of budget", async () => {
    const tools = buildFakeCatalogTools({ toolsPerServer: 11 });
    const hub = makeHub(tools);
    const agent = new Agent({ bedrock: null, hub, systemPrompt: "" });

    // Force an absurdly tight budget so the cap drops most non-Tier-1.
    const cap = agent._capTools(tools, 5000);
    const keptNames = new Set(cap.kept.map((t) => t.name));
    for (const tier1 of TIER1_MCPS.filter((s) => !["kiro-memory", "kiro-skills"].includes(s))) {
      // At least one tool from each canonical Tier-1 MCP should survive.
      const survivor = [...keptNames].some((n) => n.startsWith(`${tier1}__`));
      expect(survivor, `tier-1 ${tier1} dropped`).toBe(true);
    }
  });

  it("tier1Only mode drops every non-Tier-1 tool even if budget would fit", async () => {
    const tools = buildFakeCatalogTools({ toolsPerServer: 4 }); // 196 total
    const agent = new Agent({ bedrock: null, hub: makeHub(tools), systemPrompt: "" });
    const cap = agent._capTools(tools, 200000, { tier1Only: true });
    for (const t of cap.kept) {
      const ok = TIER1_MCPS.some((s) => t.name.startsWith(`${s}__`)) || t.name.startsWith("ares_");
      expect(ok, `non-Tier-1 tool kept: ${t.name}`).toBe(true);
    }
    // Non-Tier-1 tools should have been dropped.
    expect(cap.dropped.length).toBeGreaterThan(0);
  });

  it("preflight emits tools_capped + context_compressed before preflight_too_large", async () => {
    // Synthesize a transcript dominated by one MASSIVE first user message
    // (the anchor compressor cannot drop the first user turn — it always
    // makes the head). With ~600K of unavoidable user-text plus a sizable
    // system prompt + tool schemas, the four preflight passes can't make
    // it fit, so we bail with preflight_too_large.
    const huge = [];
    huge.push({
      role: "user",
      content: "ORIGINAL TASK — " + "z".repeat(600_000),
    });
    for (let i = 0; i < 4; i++) {
      huge.push({
        role: "assistant",
        content: [{ type: "text", text: `ack ${i}` }],
      });
      huge.push({ role: "user", content: `follow-up ${i}` });
    }

    const tools = buildFakeCatalogTools({ toolsPerServer: 11 });
    const hub = makeHub(tools);
    const bedrock = {
      profile: null,
      stream: () => { throw new Error("should not stream"); },
    };
    // Big system prompt so cumulative overhead pushes us over.
    const agent = new Agent({ bedrock, hub, systemPrompt: "x".repeat(80_000) });

    const events = [];
    for await (const ev of agent.run(huge)) {
      events.push(ev);
      if (ev.type === "error" && ev.kind === "preflight_too_large") break;
      // safety: don't loop forever
      if (events.length > 200) break;
    }

    const types = events.map((e) => e.type);
    expect(types).toContain("tools_capped");
    expect(types).toContain("context_compressed");
    const preflight = events.find((e) => e.type === "error" && e.kind === "preflight_too_large");
    expect(preflight).toBeTruthy();
    expect(Array.isArray(preflight.recovery)).toBe(true);
    // Five recovery actions: compress, strip-steering, trim-mcps, show-breakdown, new-session.
    expect(preflight.recovery.map((r) => r.id).sort()).toEqual([
      "compress", "new-session", "show-breakdown", "strip-steering", "trim-mcps",
    ]);
  });
});
