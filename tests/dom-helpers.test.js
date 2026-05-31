// Phase-10b · jsdom-driven smoke test for the extracted DOM helpers.
//
// First test that uses the jsdom environment. Establishes the harness
// pattern so future Phase 6b modules can be unit-tested directly
// instead of via static-grep checks.

// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { $, el, fmtBytes, fileIcon } from "../public/lib/dom-helpers.js";

beforeEach(() => {
  document.body.innerHTML = '<div id="anchor"></div>';
});

describe("Phase-10b · public/lib/dom-helpers.js (jsdom)", () => {
  it("$ resolves an id to an element", () => {
    expect($("anchor")).toBeInstanceOf(globalThis.HTMLElement);
    expect($("missing")).toBeNull();
  });

  it("el(tag, props, ...children) builds a node with class + text + onClick", () => {
    let clicked = 0;
    const btn = el("button", {
      class: "send-btn",
      onClick: () => { clicked++; },
    }, "Send");
    expect(btn.className).toBe("send-btn");
    expect(btn.textContent).toBe("Send");
    btn.click();
    expect(clicked).toBe(1);
  });

  it("el supports style as an object and as a string", () => {
    const a = el("div", { style: { color: "red", padding: "4px" } });
    expect(a.style.color).toBe("red");
    expect(a.style.padding).toBe("4px");
    const b = el("div", { style: "background: blue;" });
    expect(b.getAttribute("style")).toBe("background: blue;");
  });

  it("el's html: prop overrides children", () => {
    const node = el("div", { html: "<span>raw</span>" }, "ignored");
    expect(node.innerHTML).toBe("<span>raw</span>");
    expect(node.textContent).toBe("raw");
  });

  it("el accepts variadic children including null and Node", () => {
    const inner = el("span", {}, "inner");
    const out = el("div", {}, "leading ", inner, null, " trailing");
    expect(out.childNodes.length).toBe(3);
    expect(out.textContent).toBe("leading inner trailing");
  });

  it("fmtBytes formats sizes with the documented thresholds", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(4096)).toBe("4.0 KB");
    expect(fmtBytes(5_000_000)).toBe("4.8 MB");
    expect(fmtBytes(NaN)).toBe("—");
    expect(fmtBytes(-1)).toBe("—");
  });

  it("fileIcon picks a glyph from kind/mime/name", () => {
    expect(fileIcon({ kind: "image" })).toBe("🖼");
    expect(fileIcon({ mime: "image/png" })).toBe("🖼");
    expect(fileIcon({ kind: "pdf" })).toBe("📄");
    expect(fileIcon({ kind: "text" })).toBe("📝");
    expect(fileIcon({ name: "report.xlsx" })).toBe("📊");
    expect(fileIcon({ name: "doc.docx" })).toBe("📃");
    expect(fileIcon({ name: "archive.zip" })).toBe("🗜");
    expect(fileIcon({ name: "thing.bin" })).toBe("📎");
  });
});
