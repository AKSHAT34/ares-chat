// Phase-8a · UX gap smoke tests. No jsdom harness yet (Phase 10), so
// these are static checks that the wiring is present in the source.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readFile(p) { return fs.readFileSync(p, "utf8"); }

describe("Phase-8a H-2 · slash-command autocomplete", () => {
  const js = readFile(path.join(ROOT, "public", "legacy", "app.js"));

  it("listens on inputEl 'input' to trigger _maybeShowSlashPop", () => {
    expect(js).toMatch(/_maybeShowSlashPop/);
    expect(js).toMatch(/inputEl\.addEventListener\("input"/);
  });

  it("renders a .slash-pop element on match", () => {
    expect(js).toMatch(/_renderSlashPop/);
    expect(js).toMatch(/class:\s*"slash-pop"/);
  });

  it("hides the pop on blur (deferred so click fires) and Escape", () => {
    expect(js).toMatch(/inputEl\.addEventListener\("blur"/);
    expect(js).toMatch(/setTimeout\(_hideSlashPop/);
    expect(js).toMatch(/_hideSlashPop\(\)/);
  });

  it("supports arrow-up/arrow-down/Tab/Enter for selection", () => {
    expect(js).toMatch(/e\.key === "ArrowDown"/);
    expect(js).toMatch(/e\.key === "ArrowUp"/);
    expect(js).toMatch(/e\.key === "Enter" \|\| e\.key === "Tab"/);
  });

  it("filters by prefix on the in-memory catalog", () => {
    expect(js).toMatch(/c\.name\.toLowerCase\(\)\.startsWith\(prefix\)/);
  });
});

describe("Phase-8a H-4 · ⌘/ keyboard-shortcuts overlay", () => {
  const html = readFile(path.join(ROOT, "public", "legacy", "index.html"));
  const js = readFile(path.join(ROOT, "public", "legacy", "app.js"));

  it("ships a #shortcutsModal in the markup", () => {
    expect(html).toMatch(/id="shortcutsModal"/);
    expect(html).toMatch(/Keyboard shortcuts/);
  });

  it("⌘/ (or Ctrl-/) toggles the overlay (skipped while typing)", () => {
    expect(js).toMatch(/\(e\.metaKey \|\| e\.ctrlKey\) && e\.key === "\/"/);
    expect(js).toMatch(/showShortcuts\(\)/);
    expect(js).toMatch(/hideShortcuts\(\)/);
  });

  it("Esc closes the shortcuts overlay first, before lightbox/tools", () => {
    expect(js).toMatch(/!shortcutsModal\.classList\.contains\("hidden"\)/);
  });

  it("⌘N triggers newSession when not focused on text input", () => {
    expect(js).toMatch(/e\.key === "n" \|\| e\.key === "N"/);
  });

  it("renders <kbd> hints with the documented bindings", () => {
    for (const k of ["⌘ /", "⌘ N", "⌘ ↩", "⇧ ↩", "Esc", "⌘⇧ A"]) {
      expect(html).toContain(`<kbd>${k}</kbd>`);
    }
  });
});

describe("Phase-8a H-3 · full-pane drag-drop overlay", () => {
  const html = readFile(path.join(ROOT, "public", "legacy", "index.html"));

  it("uses a darkened full-pane background instead of a faint border", () => {
    expect(html).toMatch(/rgba\(10,\s*10,\s*11,\s*0\.78\)/);
    expect(html).toMatch(/backdrop-filter:\s*blur\(2px\)/);
  });

  it("renders a centred card with scale/glow animation", () => {
    expect(html).toMatch(/drop-overlay-card/);
    expect(html).toMatch(/@keyframes drop-card-in/);
  });

  it("uses Phase-7a token variables for animation timing", () => {
    expect(html).toMatch(/var\(--dur-fast\)/);
    expect(html).toMatch(/var\(--ease-(out|spring)\)/);
  });
});

describe("Phase-8a H-5 · welcome-screen footer links", () => {
  const js = readFile(path.join(ROOT, "public", "legacy", "app.js"));

  it("includes a /jobs.html link in the welcome footer", () => {
    expect(js).toMatch(/welcome-footer/);
    expect(js).toMatch(/href: "\/jobs\.html"/);
  });

  it("includes a 'See all slash commands' shortcut to /help", () => {
    expect(js).toMatch(/See all slash commands/);
  });

  it("includes a 'Keyboard shortcuts' link that opens the overlay", () => {
    expect(js).toMatch(/Keyboard shortcuts/);
    expect(js).toMatch(/showShortcuts\(\)/);
  });
});
