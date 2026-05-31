// Phase Q19 — Polly Talkback voice catalogue + cache-key shape.
// Polly itself is mocked at the SDK boundary so we don't actually
// hit AWS in tests.

import { describe, it, expect } from "vitest";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const tbPath = path.join(__dirname, "..", "lib", "talkback.js");

describe("Phase Q19 · talkback voices", () => {
  it("listVoices exposes Joanna / Brian / Lea with neural engine", async () => {
    const m = await import(tbPath);
    const voices = m.listVoices();
    expect(voices.map((v) => v.id)).toEqual(["Joanna", "Brian", "Lea"]);
    for (const v of voices) {
      expect(v.lang).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(v.description).toBeTruthy();
    }
  });

  it("synthesize rejects empty text", async () => {
    const m = await import(tbPath);
    await expect(m.synthesize({ text: "", voice: "Joanna" })).rejects.toThrow(/text is required/);
  });
});
