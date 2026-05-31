// Phase U16 — per-platform tool filter tests.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { filterToolsForPlatform, loadPlatformConfig, PLATFORM_IDS } from "../lib/platforms.js";

let TMP_HOME;
let prevHome;

beforeEach(() => {
  prevHome = process.env.HOME;
  TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ares-platforms-"));
  process.env.HOME = TMP_HOME;
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch {}
});

const TOOLS = [
  { name: "memory__memory_search", description: "" },
  { name: "memory__memory_record", description: "" },
  { name: "skills__skill_search", description: "" },
  { name: "data-query-mcp__RunQuery", description: "" },
  { name: "shell-agent__shell_exec", description: "" },
  { name: "filesystem-agent__fs_write", description: "" },
  { name: "computer-use__screen_capture", description: "" },
  { name: "kiro-browser-agent__navigate", description: "" },
  { name: "email-mcp__email_send", description: "" },
  { name: "email-mcp__email_inbox", description: "" },
  { name: "chat-mcp__post_message", description: "" },
  { name: "ares_list_mcps", description: "" },
];

describe("platforms — defaults", () => {
  it("PLATFORM_IDS exposes the 6 expected ids", () => {
    expect(PLATFORM_IDS).toEqual([
      "browser", "electron-full", "electron-compact", "cli", "slack", "outlook",
    ]);
  });

  it("loadPlatformConfig falls back to defaults when no file exists", () => {
    const cfg = loadPlatformConfig({ workspaceRoot: undefined });
    expect(cfg.platforms.browser.allow).toEqual(["*"]);
    expect(cfg.platforms.slack.deny).toEqual(["*"]);
  });
});

describe("platforms — filterToolsForPlatform", () => {
  it("browser passes everything through (allow:[*])", () => {
    const out = filterToolsForPlatform(TOOLS, "browser");
    expect(out).toHaveLength(TOOLS.length);
  });

  it("electron-compact strips computer-use / kiro-browser-agent / chrome-real", () => {
    const out = filterToolsForPlatform(TOOLS, "electron-compact").map((t) => t.name);
    expect(out).not.toContain("computer-use__screen_capture");
    expect(out).not.toContain("kiro-browser-agent__navigate");
    expect(out).toContain("memory__memory_search");
  });

  it("slack platform: only memory/skills/data-query/wiki-mcp:read + meta", () => {
    const out = filterToolsForPlatform(TOOLS, "slack").map((t) => t.name);
    expect(out).toContain("memory__memory_search");
    expect(out).toContain("memory__memory_record");
    expect(out).toContain("skills__skill_search");
    expect(out).toContain("data-query-mcp__RunQuery");
    expect(out).toContain("ares_list_mcps");
    // Heavy stuff blocked by allow-list
    expect(out).not.toContain("shell-agent__shell_exec");
    expect(out).not.toContain("filesystem-agent__fs_write");
    expect(out).not.toContain("email-mcp__email_send");
    expect(out).not.toContain("chat-mcp__post_message");
  });

  it("outlook platform: read-only mail + memory + data-query + meta", () => {
    const out = filterToolsForPlatform(TOOLS, "outlook").map((t) => t.name);
    expect(out).toContain("email-mcp__email_inbox");
    expect(out).not.toContain("email-mcp__email_send");
    expect(out).not.toContain("shell-agent__shell_exec");
  });

  it("unknown platform returns the unfiltered list (defensive)", () => {
    const out = filterToolsForPlatform(TOOLS, "tiktok");
    expect(out).toHaveLength(TOOLS.length);
  });

  it("no platform arg returns the unfiltered list", () => {
    const out = filterToolsForPlatform(TOOLS);
    expect(out).toHaveLength(TOOLS.length);
  });
});

describe("platforms — config override", () => {
  it("workspace ares-config.json overrides global", () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "ares-ws-"));
    fs.mkdirSync(path.join(ws, ".ares"), { recursive: true });
    fs.writeFileSync(path.join(ws, ".ares", "ares-config.json"), JSON.stringify({
      platforms: {
        cli: { allow: ["memory__*"], deny: ["*"] },
      },
    }));
    const out = filterToolsForPlatform(TOOLS, "cli", { workspaceRoot: ws }).map((t) => t.name);
    expect(out).toEqual(["memory__memory_search", "memory__memory_record"]);
    fs.rmSync(ws, { recursive: true, force: true });
  });
});

describe("platforms — wildcard matcher edge cases", () => {
  it("exact match without wildcard", () => {
    const out = filterToolsForPlatform([{ name: "ares_list_mcps", description: "" }], "slack").map((t) => t.name);
    expect(out).toEqual(["ares_list_mcps"]);
  });

  it("prefix-with-* pattern matches any tool from that server", () => {
    const out = filterToolsForPlatform(
      [{ name: "memory__a", description: "" }, { name: "memory__b", description: "" }, { name: "skills__c", description: "" }],
      "outlook"
    ).map((t) => t.name);
    expect(out).toEqual(expect.arrayContaining(["memory__a", "memory__b", "skills__c"]));
  });
});
