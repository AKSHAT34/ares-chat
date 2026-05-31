// Tests for saveProgress behavior: never overwrite with shorter arrays
// (compression), only append genuinely new tail messages.

import { describe, it, expect } from "vitest";

/**
 * Extracted saveProgress logic (mirrors server.js implementation).
 * Takes the session's existing messages and the incoming messages array,
 * returns the resulting session.messages after the operation.
 */
function saveProgress(sessionMessages, incomingMessages) {
  if (!incomingMessages || incomingMessages.length <= 1) return [...sessionMessages];
  const priorLen = sessionMessages.length;

  // If incoming is shorter or same length (compression), do NOT overwrite.
  if (incomingMessages.length <= priorLen) return [...sessionMessages];

  // Append only the new tail.
  const newMessages = incomingMessages.slice(priorLen);
  return [...sessionMessages, ...newMessages];
}

describe("saveProgress — no-overwrite invariant", () => {
  it("does NOT overwrite when receiving a shorter array (compression)", () => {
    const existing = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
      { role: "user", content: [{ type: "text", text: "Tell me about X" }] },
      { role: "assistant", content: [{ type: "text", text: "X is..." }] },
    ];

    // Simulate compression producing fewer messages (context_summary replaces some)
    const compressed = [
      { role: "user", content: [{ type: "text", text: "<context_summary>...</context_summary>" }] },
      { role: "assistant", content: [{ type: "text", text: "X is..." }] },
    ];

    const result = saveProgress(existing, compressed);
    // Must preserve the original messages unchanged
    expect(result).toEqual(existing);
    expect(result.length).toBe(4);
  });

  it("does NOT overwrite when receiving same-length array", () => {
    const existing = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
    ];

    const sameLength = [
      { role: "user", content: [{ type: "text", text: "Modified" }] },
      { role: "assistant", content: [{ type: "text", text: "Different" }] },
    ];

    const result = saveProgress(existing, sameLength);
    expect(result).toEqual(existing);
  });

  it("appends only the new tail when receiving a longer array", () => {
    const existing = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
    ];

    const longer = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
      { role: "user", content: [{ type: "text", text: "What is 2+2?" }] },
      { role: "assistant", content: [{ type: "text", text: "4" }] },
    ];

    const result = saveProgress(existing, longer);
    expect(result.length).toBe(4);
    // Original messages preserved
    expect(result[0]).toEqual(existing[0]);
    expect(result[1]).toEqual(existing[1]);
    // New messages appended
    expect(result[2]).toEqual(longer[2]);
    expect(result[3]).toEqual(longer[3]);
  });

  it("is a no-op when incoming is null or has ≤1 message", () => {
    const existing = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];

    expect(saveProgress(existing, null)).toEqual(existing);
    expect(saveProgress(existing, [])).toEqual(existing);
    expect(saveProgress(existing, [{ role: "user", content: "x" }])).toEqual(existing);
  });

  it("appends correctly when existing is empty and incoming has >1 messages", () => {
    const existing = [];
    const incoming = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
    ];

    const result = saveProgress(existing, incoming);
    expect(result.length).toBe(2);
    expect(result).toEqual(incoming);
  });
});
