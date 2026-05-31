// Phase-3 audit · B-9 · TOOL_INPUT_OVERRIDES keys must match real MCP tools.
//
// Pre-fix bug: the override map listed `filesystem-agent__write_file` but
// the actual filesystem-agent MCP exposes `fs_write`. Legit 5 KB+ file
// writes hit the 4 KB cap and got rejected.
//
// This test enforces the format and pins the known-good keys, so a future
// rename or typo gets caught at test time instead of in production.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function extractOverrides() {
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "mcp-client.js"), "utf8");
  const m = src.match(/TOOL_INPUT_OVERRIDES\s*=\s*\{([\s\S]*?)\}/);
  if (!m) throw new Error("could not locate TOOL_INPUT_OVERRIDES");
  const body = m[1];
  const keys = [];
  for (const line of body.split("\n")) {
    const km = line.match(/"([^"]+)"\s*:/);
    if (km) keys.push(km[1]);
  }
  return keys;
}

describe("Phase-3 B-9 · TOOL_INPUT_OVERRIDES key shape audit", () => {
  it("every key is in <server>__<tool> form", () => {
    for (const k of extractOverrides()) {
      expect(k, k).toMatch(/^[a-z][a-z0-9-]+__[a-z][a-z0-9_]*$/i);
    }
  });

  it("filesystem-agent override targets fs_write (the tool that actually exists)", () => {
    const keys = extractOverrides();
    expect(keys).toContain("filesystem-agent__fs_write");
    // Belt-and-braces: ensure the legacy/wrong key did not get re-introduced.
    expect(keys).not.toContain("filesystem-agent__write_file");
  });

  it("no duplicate keys", () => {
    const keys = extractOverrides();
    expect(new Set(keys).size).toBe(keys.length);
  });
});
