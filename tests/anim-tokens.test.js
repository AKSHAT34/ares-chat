// Phase-7a · animation token system smoke test.
//
// Verifies the prompt's defaults are present in lib/anim.css and that the
// reduced-motion override collapses every duration to 1ms. Compact.html
// is checked separately because it inlines its own copy (file:// load).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readFile(p) { return fs.readFileSync(p, "utf8"); }

describe("Phase-7a · animation tokens (lib/anim.css)", () => {
  const css = readFile(path.join(ROOT, "public", "lib", "anim.css"));

  it("declares the prompt's ease curves verbatim", () => {
    expect(css).toMatch(/--ease-out:\s*cubic-bezier\(0\.22,\s*0\.61,\s*0\.36,\s*1\)/);
    expect(css).toMatch(/--ease-in-out:\s*cubic-bezier\(0\.65,\s*0,\s*0\.35,\s*1\)/);
    expect(css).toMatch(/--ease-spring:\s*cubic-bezier\(0\.5,\s*1\.6,\s*0\.4,\s*1\)/);
  });

  it("declares the prompt's three durations verbatim", () => {
    expect(css).toMatch(/--dur-fast:\s*120ms/);
    expect(css).toMatch(/--dur-base:\s*200ms/);
    expect(css).toMatch(/--dur-slow:\s*320ms/);
  });

  it("ships a slow-mo ladder gated by [data-anim-slow=\"1\"]", () => {
    expect(css).toMatch(/\[data-anim-slow="1"\]/);
    expect(css).toMatch(/--dur-fast:\s*480ms/);
    expect(css).toMatch(/--dur-base:\s*800ms/);
    expect(css).toMatch(/--dur-slow:\s*1280ms/);
  });

  it("ships a prefers-reduced-motion override that collapses to 1ms", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/animation-duration:\s*1ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*1ms\s*!important/);
  });
});

describe("Phase-7a · anim.js (runtime helpers)", () => {
  const js = readFile(path.join(ROOT, "public", "lib", "anim.js"));

  it("exports prefersReducedMotion + animTokens + readDurationMs", () => {
    expect(js).toMatch(/export function prefersReducedMotion/);
    expect(js).toMatch(/export const animTokens/);
    expect(js).toMatch(/export function readDurationMs/);
  });

  it("reads the ares-anim-slow cookie at module load", () => {
    expect(js).toMatch(/ares-anim-slow=1/);
  });

  it("toggles dataset.animSlow on documentElement based on the cookie", () => {
    expect(js).toMatch(/document\.documentElement\.dataset\.animSlow/);
  });
});

describe("Phase-7a · pages reference the token CSS", () => {
  it("index.html links /lib/anim.css", () => {
    const html = readFile(path.join(ROOT, "public", "legacy", "index.html"));
    expect(html).toMatch(/href="\/lib\/anim\.css/);
  });

  it("jobs.html links /lib/anim.css", () => {
    const html = readFile(path.join(ROOT, "public", "legacy", "jobs.html"));
    expect(html).toMatch(/href="\/lib\/anim\.css/);
  });
});

describe("Phase-7a · /api/dev/anim?slow=1 endpoint", () => {
  const src = readFile(path.join(ROOT, "server.js"));

  it("registers GET /api/dev/anim that sets/clears the ares-anim-slow cookie", () => {
    expect(src).toMatch(/app\.get\("\/api\/dev\/anim"/);
    expect(src).toMatch(/ares-anim-slow=1/);
    expect(src).toMatch(/Max-Age=86400/);
  });
});
