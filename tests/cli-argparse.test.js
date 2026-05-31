// Phase U07a — argparse tests for the Ares CLI.

import { describe, it, expect } from "vitest";
import { parseArgs } from "../lib/cli/argparse.js";

const SCHEMA = {
  boolean: ["help", "version"],
  string: ["model", "profile", "workspace"],
};

describe("parseArgs", () => {
  it("empty argv → no command, opts._ empty", () => {
    const { command, opts } = parseArgs([], SCHEMA);
    expect(command).toBeUndefined();
    expect(opts._).toEqual([]);
  });

  it("first positional becomes command", () => {
    const { command } = parseArgs(["chat"], SCHEMA);
    expect(command).toBe("chat");
  });

  it("boolean flag with no value → true", () => {
    const { opts } = parseArgs(["--help"], SCHEMA);
    expect(opts.help).toBe(true);
  });

  it("string flag with --foo bar form", () => {
    const { opts } = parseArgs(["--model", "haiku"], SCHEMA);
    expect(opts.model).toBe("haiku");
  });

  it("string flag with --foo=bar form", () => {
    const { opts } = parseArgs(["--model=opus"], SCHEMA);
    expect(opts.model).toBe("opus");
  });

  it("string flag at end without arg → true", () => {
    const { opts } = parseArgs(["--model"], SCHEMA);
    expect(opts.model).toBe(true);
  });

  it("preserves multi-positional arg order in opts._", () => {
    const { command, opts } = parseArgs(["kiro", "migrate", "--dry-run"], SCHEMA);
    expect(command).toBe("kiro");
    expect(opts._).toEqual(["kiro", "migrate"]);
    expect(opts["dry-run"]).toBe(true);
  });

  it("`--` ends option parsing, remaining args land in opts._", () => {
    const { opts } = parseArgs(["chat", "--", "--not-a-flag", "literal"], SCHEMA);
    expect(opts._).toEqual(["chat", "--not-a-flag", "literal"]);
  });

  it("multiple flags + positionals interleaved", () => {
    const { command, opts } = parseArgs(["--profile", "your-aws-profile", "tools", "--workspace=/tmp"], SCHEMA);
    expect(command).toBe("tools");
    expect(opts.profile).toBe("your-aws-profile");
    expect(opts.workspace).toBe("/tmp");
  });

  it("string flag followed by another flag does NOT eat the next flag as a value", () => {
    const { opts } = parseArgs(["--model", "--help"], SCHEMA);
    expect(opts.model).toBe(true);
    expect(opts.help).toBe(true);
  });
});
