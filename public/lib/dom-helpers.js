// Phase 6b — DOM helper utilities extracted from public/app.js.
//
// Plain ES module, no globals. Consumers import explicitly:
//   import { $, el, fmtBytes, fileIcon } from "./lib/dom-helpers.js";
//
// The helpers here are PRESENTATION-only and have no dependency on the
// app.js state object — that makes them safe to use from compact.html
// (via copy/paste) and from future jsdom unit tests.

/** Shorthand for document.getElementById. */
export const $ = (id) => document.getElementById(id);

/**
 * Tiny createElement wrapper. Accepts:
 *   - tag: HTML tag name
 *   - props: { class, style, on*, html, attribute, ...DOM-properties }
 *   - children: variadic Nodes / strings / null
 *
 * Special keys:
 *   - html       — set innerHTML AFTER any sanitisation the caller did
 *                  (use sparingly; prefer text nodes)
 *   - on*        — addEventListener for the suffix lower-cased
 *   - style: obj — applied as Object.assign(node.style, ...)
 *   - style: str — applied as setAttribute("style", ...)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  let hasHtml = false;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") {
      if (typeof v === "string") node.setAttribute("style", v);
      else Object.assign(node.style, v);
    } else if (k === "html") {
      node.innerHTML = v;
      hasHtml = true;
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node) {
      try { node[k] = v; } catch { node.setAttribute(k, v); }
    } else {
      node.setAttribute(k, v);
    }
  }
  if (!hasHtml) {
    for (const c of children) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : String(c));
    }
  }
  return node;
}

/** Human byte count: 12 → "12 B"; 4096 → "4.0 KB"; 5e6 → "4.8 MB". */
export function fmtBytes(n) {
  if (typeof n !== "number" || !isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Pick a leading emoji glyph for an attachment kind / mime. */
export function fileIcon({ kind, mime, name } = {}) {
  if (kind === "image" || (mime || "").startsWith("image/")) return "🖼";
  if (kind === "pdf"   || mime === "application/pdf") return "📄";
  if (kind === "text") return "📝";
  if (/\.(zip|tar\.gz|tgz|7z|rar)$/i.test(name || "")) return "🗜";
  if (/\.(xlsx?|csv|tsv)$/i.test(name || "")) return "📊";
  if (/\.(docx?)$/i.test(name || "")) return "📃";
  return "📎";
}
