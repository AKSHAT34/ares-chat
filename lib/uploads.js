// Handles file uploads and converts them to the right Bedrock Claude
// content blocks. What Claude natively supports:
//   - images: png, jpeg, gif, webp → image block (base64)
//   - PDFs → document block (base64)
//   - text/code/markdown/csv/json/html/xml/yaml → text block
//   - everything else → we save to disk and return a text block
//     pointing at the path, so Ares can open it with the
//     filesystem/shell/excel MCPs.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const NATIVE_IMAGE_MEDIA_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
]);

export const TEXT_LIKE_MEDIA_TYPES = new Set([
  "text/plain", "text/markdown", "text/html", "text/csv", "text/xml",
  "text/x-python", "text/x-java", "text/x-c", "text/x-c++", "text/javascript",
  "application/json", "application/xml", "application/x-yaml", "application/yaml",
  "application/javascript", "application/typescript", "application/x-sh",
  "application/x-python",
]);

// Extensions whose payload is safe to inline even if multer guesses
// application/octet-stream for them.
const TEXT_EXTS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml",
  ".html", ".htm", ".log", ".ini", ".env", ".cfg", ".toml",
  ".py", ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs",
  ".java", ".c", ".cc", ".cpp", ".h", ".hpp", ".rs", ".go", ".rb", ".php",
  ".sh", ".zsh", ".bash", ".fish", ".sql", ".graphql",
]);

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const MAX_INLINE_TEXT_BYTES = 512 * 1024; // 512 KB before we switch to path-based

// E-6: escape attribute values for the synthetic <file>/<attachment>
// wrappers we wrap user-supplied filenames in before sending to Bedrock.
function _escapeFileAttr(s) {
  return String(s ?? "").replace(/["'<>\r\n]/g, "_");
}

/**
 * Given an uploaded file, return:
 *   { kind: "image"|"pdf"|"text"|"file", block, meta }
 *   - block: a Claude content block, OR null (for path-based)
 *   - meta: { name, mime, sizeBytes, path?, displayText? }
 */
// E-8: magic-number signatures for known binary formats. We use these
// to override a client-supplied `text/*` mime if the file's first bytes
// don't actually look like text. Pre-fix a hostile attachment could
// claim text/plain, sail through `mime.startsWith("text/")`, and get
// `buf.toString("utf8")`'d into the prompt where the binary noise
// could carry a prompt-injection payload.
function _looksBinary(buf) {
  if (!buf || buf.length === 0) return false;
  // PNG / JPEG / GIF / WebP / PDF / ZIP / 7z / Mach-O / ELF / RAR.
  const sigs = [
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0xff, 0xd8, 0xff],        // JPEG
    [0x47, 0x49, 0x46, 0x38],  // GIF
    [0x52, 0x49, 0x46, 0x46],  // RIFF (WebP / WAV)
    [0x25, 0x50, 0x44, 0x46],  // %PDF
    [0x50, 0x4b, 0x03, 0x04],  // ZIP / DOCX / XLSX
    [0x50, 0x4b, 0x05, 0x06],  // ZIP empty
    [0x37, 0x7a, 0xbc, 0xaf],  // 7z
    [0xcf, 0xfa, 0xed, 0xfe],  // Mach-O 64
    [0x7f, 0x45, 0x4c, 0x46],  // ELF
    [0x52, 0x61, 0x72, 0x21],  // RAR
  ];
  for (const sig of sigs) {
    let match = true;
    for (let i = 0; i < sig.length; i++) {
      if (buf[i] !== sig[i]) { match = false; break; }
    }
    if (match) return true;
  }
  // Heuristic: high density of non-printable bytes in the first 512.
  const sample = buf.slice(0, Math.min(512, buf.length));
  let nonPrintable = 0;
  for (const b of sample) {
    // Allow tab (9), LF (10), CR (13), and printable 32–126 + extended UTF-8 (>=128).
    if (b === 9 || b === 10 || b === 13) continue;
    if (b >= 32 && b <= 126) continue;
    if (b >= 0x80) continue; // potentially UTF-8 multi-byte
    nonPrintable++;
  }
  return nonPrintable / sample.length > 0.30;
}

export async function processUpload(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  let mime = file.mimetype || "application/octet-stream";

  // multer sometimes says octet-stream for text files — correct by ext.
  if (mime === "application/octet-stream" && TEXT_EXTS.has(ext)) {
    mime = "text/plain";
  }
  if (mime === "application/octet-stream" && IMAGE_EXTS.has(ext)) {
    mime = "image/" + (ext === ".jpg" ? "jpeg" : ext.slice(1));
  }

  const buf = await fs.readFile(file.path);

  // E-8: defang client-claimed text/* if the first bytes don't pass
  // the binary sniff. Demote to application/octet-stream so the file
  // takes the path-based fallback (saved on disk; agent can decide
  // how to open it via filesystem-agent / unzip / etc).
  if (mime.startsWith("text/") && _looksBinary(buf)) {
    mime = "application/octet-stream";
  }
  const meta = {
    name: file.originalname,
    mime,
    sizeBytes: buf.length,
    path: file.path,
  };

  // Native image
  if (NATIVE_IMAGE_MEDIA_TYPES.has(mime)) {
    return {
      kind: "image",
      block: {
        type: "image",
        source: { type: "base64", media_type: mime, data: buf.toString("base64") },
      },
      meta,
    };
  }

  // PDF → Claude document block
  if (mime === "application/pdf") {
    return {
      kind: "pdf",
      block: {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
        title: file.originalname,
      },
      meta,
    };
  }

  // Text-like → inline as text block (capped at 512KB)
  const isText = TEXT_LIKE_MEDIA_TYPES.has(mime)
    || mime.startsWith("text/")
    || TEXT_EXTS.has(ext);
  if (isText && buf.length <= MAX_INLINE_TEXT_BYTES) {
    const text = buf.toString("utf8");
    return {
      kind: "text",
      block: {
        type: "text",
        text: `<file name="${_escapeFileAttr(file.originalname)}" mime="${_escapeFileAttr(mime)}" size="${buf.length}">\n${text}\n</file>`,
      },
      meta,
    };
  }

  // Fallback — save it under uploads/ and return a text block telling
  // Ares where the file lives + which tools to use on it.
  return {
    kind: "file",
    block: {
      type: "text",
      text: `<attachment name="${_escapeFileAttr(file.originalname)}" mime="${_escapeFileAttr(mime)}" size="${buf.length}" path="${_escapeFileAttr(file.path)}">\nThis file is saved at the path above. Use the filesystem-agent, shell-agent, or mac-apps MCPs to open / parse it (e.g. excel for xlsx, docx handlers for Word docs, unzip for archives).\n</attachment>`,
    },
    meta,
  };
}

/**
 * Where multer stores uploads. Per-session subdirectory so each chat has
 * its own folder on disk, accessible by the filesystem/shell MCPs.
 */
export function uploadsDirFor(sessionId, root) {
  const dir = path.join(root, "uploads", sessionId);
  return dir;
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function makeFilename(originalName) {
  const ext = path.extname(originalName);
  const stem = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(3).toString("hex");
  return `${stem}-${stamp}-${rand}${ext}`;
}
