// Phase RP1-B2 — auto-recorder eligibility gate tests.

import { describe, it, expect } from "vitest";
import { isAutoRecorderEligible, lastAssistantTextFromMessages } from "../lib/auto-record-gate.js";

const asAssistantText = (text) => ({
  role: "assistant",
  content: [{ type: "text", text }],
});

describe("lastAssistantTextFromMessages", () => {
  it("returns the last assistant text when content is array-of-blocks", () => {
    const m = [
      { role: "user", content: "hi" },
      asAssistantText("first"),
      { role: "user", content: "ok" },
      asAssistantText("second"),
    ];
    expect(lastAssistantTextFromMessages(m)).toBe("second");
  });

  it("returns string-content assistant directly", () => {
    const m = [{ role: "assistant", content: "plain string content" }];
    expect(lastAssistantTextFromMessages(m)).toBe("plain string content");
  });

  it("returns empty when last assistant has only tool_use / tool_result blocks", () => {
    const m = [
      asAssistantText("real"),
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "tu1", name: "x", input: {} }],
      },
    ];
    expect(lastAssistantTextFromMessages(m)).toBe("");
  });

  it("returns empty when no assistant message exists", () => {
    expect(lastAssistantTextFromMessages([{ role: "user", content: "alone" }])).toBe("");
  });

  it("returns empty on non-array input", () => {
    expect(lastAssistantTextFromMessages(null)).toBe("");
    expect(lastAssistantTextFromMessages(undefined)).toBe("");
  });
});

describe("isAutoRecorderEligible", () => {
  it("genuine text → true", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText("Got the data — here are the top 5 vendors by MetricB variance…")],
    })).toBe(true);
  });

  it("sawCredentialError flag → false even with real text", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: true,
      finalMessages: [asAssistantText("Got the data — here are the top 5…")],
    })).toBe(false);
  });

  it("Bedrock error preamble → false", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText("Bedrock error: The security token …isengardcli")],
    })).toBe(false);
  });

  it("Bedrock prompt-too-long preamble → false", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText("Bedrock prompt-too-long after 3 retries: …")],
    })).toBe(false);
  });

  it("isengardcli mentioned anywhere in the first 200 chars → false", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText("isengardcli credential refresh failed mid-stream")],
    })).toBe(false);
  });

  it("auth-init-prefixed text → false", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText("auth-init -s required to continue")],
    })).toBe(false);
  });

  it("empty/whitespace text → false", () => {
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText("   \n  ")],
    })).toBe(false);
  });

  it("missing finalMessages → false (no real text to record)", () => {
    expect(isAutoRecorderEligible({})).toBe(false);
    expect(isAutoRecorderEligible({ sawCredentialError: false })).toBe(false);
  });

  it("error preamble after position 200 chars is fine — gate only checks the start", () => {
    const head = "Real analysis intro that goes on for a while ".repeat(6); // ~280 chars
    expect(isAutoRecorderEligible({
      sawCredentialError: false,
      finalMessages: [asAssistantText(head + "Bedrock error: tail-of-string")],
    })).toBe(true);
  });

  it("text-only-with-tool-use trailing block → falls back to most recent text-bearing assistant", () => {
    const m = [
      asAssistantText("the real analysis text"),
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "x" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "tu2", name: "y", input: {} }] },
    ];
    // The last assistant has only tool_use → empty → false. (We
    // intentionally don't fall back further; the upstream flow stamps
    // a final assistant turn on a healthy run.)
    expect(isAutoRecorderEligible({ sawCredentialError: false, finalMessages: m })).toBe(false);
  });
});
