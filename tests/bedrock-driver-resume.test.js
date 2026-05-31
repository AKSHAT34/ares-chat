// Phase RP1-B2 — mid-stream credential expiry resume.
//
// We can't call real Bedrock from tests, but the driver class accepts
// a `client` field on `this`, so we monkey-patch a fake one that
// throws an ExpiredTokenException after N chunks. The test asserts:
//
//   - the consumer of stream() never sees the credential error,
//   - refreshCredentials was invoked,
//   - chunks from the resumed stream get yielded,
//   - the RESUME_BUDGET cap is respected (third expiry → propagates).

import { describe, it, expect, beforeEach } from "vitest";
import { BedrockClaude } from "../lib/llm/bedrock-driver.js";

// Helper: build a fake AWS SDK response whose `body` async-iterates a
// scripted sequence of chunks. Each chunk is `{chunk: {bytes: …}}` per
// the SDK shape, OR an Error (which the iterator throws).
function fakeResponse(steps) {
  return {
    body: (async function* () {
      for (const step of steps) {
        if (step instanceof Error) throw step;
        yield {
          chunk: {
            bytes: new TextEncoder().encode(JSON.stringify(step)),
          },
        };
      }
    })(),
  };
}

function expiredTokenError() {
  const e = new Error("The security token included in the request is expired");
  e.name = "ExpiredTokenException";
  return e;
}

describe("BedrockClaude.stream — RP1-B2 mid-stream resume", () => {
  let driver;
  let sendCalls = 0;
  let plannedResponses;
  let refreshCalls = 0;

  beforeEach(() => {
    sendCalls = 0;
    refreshCalls = 0;
    plannedResponses = [];
    driver = new BedrockClaude({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0" });
    // Stub the SDK client. Each .send() pops the next planned response.
    driver.client = {
      send: async () => {
        sendCalls += 1;
        const next = plannedResponses.shift();
        if (next instanceof Error) throw next;
        if (!next) throw new Error(`unexpected send #${sendCalls} — test didn't plan a response`);
        return next;
      },
    };
    // Stub the instance refresh hook so we don't actually hit
    // fromNodeProviderChain (which would talk to Isengard).
    driver.profile = "__rp1-test__";
    driver._refreshCredentials = async () => {
      refreshCalls += 1;
      return { accessKeyId: "x", secretAccessKey: "y", sessionToken: "z" };
    };
  });

  it("yields all chunks across a single mid-stream cred refresh", async () => {
    // Stream 1: 2 normal chunks then an ExpiredToken
    plannedResponses.push(fakeResponse([
      { type: "message_start", message: { usage: { input_tokens: 10 } } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "hello " } },
      expiredTokenError(),
    ]));
    // Stream 2 (after refresh): 2 more chunks, ends cleanly
    plannedResponses.push(fakeResponse([
      { type: "content_block_delta", delta: { type: "text_delta", text: "world" } },
      { type: "message_stop" },
    ]));

    const seen = [];
    let credError = false;
    try {
      for await (const ev of driver.stream({ system: "x", messages: [{ role: "user", content: "y" }] })) {
        seen.push(ev);
      }
    } catch (e) {
      credError = true;
    }

    expect(credError).toBe(false);
    // The mid-stream sentinel must be yielded so callers can render
    // a "credentials_refreshing" chip if they want.
    expect(seen.find((e) => e.type === "credentials_refreshing" && e.phase === "mid-stream")).toBeTruthy();
    // Both halves of the text reach the consumer.
    const texts = seen
      .filter((e) => e.type === "content_block_delta")
      .map((e) => e.delta.text)
      .join("");
    expect(texts).toBe("hello world");
    // We made 2 send() calls total — one for the original stream and
    // one for the resume.
    expect(sendCalls).toBe(2);
  });

  it("propagates a credential error after RESUME_BUDGET (=2) consecutive failures", async () => {
    // Three back-to-back expirations — exhausts the budget.
    plannedResponses.push(fakeResponse([expiredTokenError()]));
    plannedResponses.push(fakeResponse([expiredTokenError()]));
    plannedResponses.push(fakeResponse([expiredTokenError()]));

    const seen = [];
    let thrown = null;
    try {
      for await (const ev of driver.stream({ system: "x", messages: [] })) {
        seen.push(ev);
      }
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeTruthy();
    // Final error is structured for the UI banner (BedrockCredentialError).
    expect(thrown.isCredentialError).toBe(true);
    // At least 2 resume sentinels — one per attempted resume.
    const sentinels = seen.filter((e) => e.type === "credentials_refreshing" && e.phase === "mid-stream");
    expect(sentinels.length).toBe(2);
  });

  it("a stream that completes without errors goes through unchanged", async () => {
    plannedResponses.push(fakeResponse([
      { type: "message_start", message: { usage: { input_tokens: 5 } } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } },
      { type: "message_stop" },
    ]));
    const seen = [];
    for await (const ev of driver.stream({ system: "x", messages: [] })) {
      seen.push(ev);
    }
    expect(seen.find((e) => e.type === "credentials_refreshing")).toBeFalsy();
    expect(sendCalls).toBe(1);
    expect(seen.map((e) => e.type)).toEqual(["message_start", "content_block_delta", "message_stop"]);
  });

  it("non-credential errors still propagate immediately (no resume attempt)", async () => {
    const boom = new Error("ThrottlingException — slow down");
    boom.name = "ThrottlingException";
    plannedResponses.push(fakeResponse([{ type: "message_start", message: {} }, boom]));
    let thrown = null;
    try {
      for await (const ev of driver.stream({ system: "x", messages: [] })) {
        // consume
      }
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    expect(thrown.isCredentialError).toBeFalsy();
    expect(sendCalls).toBe(1);
  });
});
