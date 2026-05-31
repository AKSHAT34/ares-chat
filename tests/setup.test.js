// Phase U17 — setup wizard YAML round-trip + cli wiring tests.

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _yaml, getConfigPath } from "../lib/cli/setup-command.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN = path.join(ROOT, "bin", "ares.js");

describe("setup — YAML emitter / parser round-trip", () => {
  it("emits flat scalar values with correct quoting", () => {
    const out = _yaml.emit({
      aws_profile: "your-aws-profile",
      aws_region: "us-west-2",
      default_model: "us.anthropic.claude-sonnet-4-20250514",
    });
    expect(out).toMatch(/aws_profile: your-aws-profile/);
    expect(out).toMatch(/aws_region: us-west-2/);
    expect(out).toMatch(/default_model: us\.anthropic\.claude-sonnet-4-20250514/);
  });

  it("quotes values containing spaces or yaml-special chars", () => {
    const out = _yaml.emit({ note: "hello world: with colon" });
    expect(out).toMatch(/note: ".*hello world: with colon.*"/);
  });

  it("emits arrays as bullet list", () => {
    const out = _yaml.emit({ enabled_on_demand_mcps: ["data-query-mcp", "wiki-mcp"] });
    expect(out).toMatch(/enabled_on_demand_mcps:/);
    expect(out).toMatch(/  - "data-query-mcp"/);
    expect(out).toMatch(/  - "wiki-mcp"/);
  });

  it("emits empty array as []", () => {
    const out = _yaml.emit({ enabled_on_demand_mcps: [] });
    expect(out).toMatch(/enabled_on_demand_mcps: \[\]/);
  });

  it("emits nested objects", () => {
    const out = _yaml.emit({ gateway: { slack_channels: ["C1", "C2"] } });
    expect(out).toMatch(/gateway:/);
    expect(out).toMatch(/  slack_channels:/);
    expect(out).toMatch(/    - "C1"/);
  });

  it("parses what it emits — round-trip on a canonical config", () => {
    const original = {
      aws_profile: "your-aws-profile",
      aws_region: "us-west-2",
      default_model: "us.anthropic.claude-sonnet-4-20250514",
      enabled_on_demand_mcps: ["data-query-mcp", "email-mcp"],
      gateway: {
        slack_channels: ["C1234", "C5678"],
        outlook_folders: ["Inbox", "Vendors"],
      },
      written_at: "2026-05-23T15:00:00.000Z",
    };
    const yaml = _yaml.emit(original);
    const parsed = _yaml.parse(yaml);
    expect(parsed.aws_profile).toBe("your-aws-profile");
    expect(parsed.default_model).toBe("us.anthropic.claude-sonnet-4-20250514");
    expect(parsed.enabled_on_demand_mcps).toEqual(["data-query-mcp", "email-mcp"]);
    expect(parsed.gateway.slack_channels).toEqual(["C1234", "C5678"]);
    expect(parsed.gateway.outlook_folders).toEqual(["Inbox", "Vendors"]);
  });

  it("getConfigPath returns the canonical ~/.ares/config.yaml", () => {
    const p = getConfigPath();
    expect(p).toMatch(/\.ares\/config\.yaml$/);
  });
});

describe("setup — CLI wiring", () => {
  it("`ares setup --help`-ish: setup is a known subcommand", () => {
    const help = spawnSync(process.execPath, [BIN, "--help"], { cwd: ROOT, encoding: "utf8", timeout: 4000 });
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/setup\s+First-run config wizard/);
  });
});
