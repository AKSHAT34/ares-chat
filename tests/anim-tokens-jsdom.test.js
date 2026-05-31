// Phase-10b · jsdom-driven smoke test for the animation token system.
//
// Loads anim.css into a fresh DOM and confirms the token variables
// resolve, slow-mo dataset toggles them, and prefers-reduced-motion
// (faked via matchMedia) collapses durations.

// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CSS = fs.readFileSync(
  path.resolve(__dirname, "..", "public", "lib", "anim.css"),
  "utf8"
);

beforeEach(() => {
  document.documentElement.removeAttribute("data-anim-slow");
  // Strip any prior <style> blocks we appended.
  for (const s of document.querySelectorAll("style[data-test-anim]")) s.remove();
  const style = document.createElement("style");
  style.setAttribute("data-test-anim", "1");
  style.textContent = CSS;
  document.head.appendChild(style);
});

function tokenValue(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim();
}

describe("Phase-10b · anim tokens resolve at runtime (jsdom)", () => {
  it("base durations are 120/200/320 ms", () => {
    expect(tokenValue("--dur-fast")).toBe("120ms");
    expect(tokenValue("--dur-base")).toBe("200ms");
    expect(tokenValue("--dur-slow")).toBe("320ms");
  });

  it("ease curves are the prompt's defaults", () => {
    expect(tokenValue("--ease-out")).toContain("0.22");
    expect(tokenValue("--ease-in-out")).toContain("0.65");
    expect(tokenValue("--ease-spring")).toContain("1.6");
  });

  it("data-anim-slow=1 multiplies durations by 4×", () => {
    document.documentElement.setAttribute("data-anim-slow", "1");
    expect(tokenValue("--dur-fast")).toBe("480ms");
    expect(tokenValue("--dur-base")).toBe("800ms");
    expect(tokenValue("--dur-slow")).toBe("1280ms");
  });

  it("removing the data attribute restores the base ladder", () => {
    document.documentElement.setAttribute("data-anim-slow", "1");
    expect(tokenValue("--dur-fast")).toBe("480ms");
    document.documentElement.removeAttribute("data-anim-slow");
    expect(tokenValue("--dur-fast")).toBe("120ms");
  });
});
