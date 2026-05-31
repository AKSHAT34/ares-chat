// Phase U15 — voice-memo transcription tests (no live AWS call).

import { describe, it, expect } from "vitest";
import * as voice from "../lib/voice/transcribe.js";

describe("voice — module surface", () => {
  it("exports transcribeBuffer + transcribeProbe", () => {
    expect(typeof voice.transcribeBuffer).toBe("function");
    expect(typeof voice.transcribeProbe).toBe("function");
  });

  it("transcribeProbe returns sdk-loaded shape", () => {
    const p = voice.transcribeProbe();
    expect(typeof p.region).toBe("string");
    expect(typeof p.profile).toBe("string");
    expect(p.sdkLoaded).toBe(true);
  });

  it("rejects empty audio buffer", async () => {
    await expect(voice.transcribeBuffer({ audio: Buffer.alloc(0) })).rejects.toThrow(/audio buffer is required/);
  });

  it("rejects non-Buffer input", async () => {
    await expect(voice.transcribeBuffer({ audio: "not-a-buffer" })).rejects.toThrow(/audio buffer is required/);
  });

  it("rejects undefined input", async () => {
    await expect(voice.transcribeBuffer({})).rejects.toThrow(/audio buffer is required/);
  });
});
