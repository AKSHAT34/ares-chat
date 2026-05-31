// Phase Q2 — vitest config so tests can dynamic-import .ts files from
// ../ares-ui/src. Without this, the default "fileParallelism" rules
// + file-server allowlist refuse to load anything outside the
// ares-chat root. We also need esbuild's TS transform.
//
// Kept minimal — every prior test (355+ baseline) was driven by the
// inferred default config. This file is purely additive.

import { defineConfig } from "vitest/config";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  // Allow dynamic-import of files in sibling packages (ares-ui).
  server: {
    fs: {
      // Two levels up so sibling packages are reachable.
      allow: [path.resolve(__dirname, "..")],
    },
  },
  test: {
    // Default already; explicit so reviewers don't have to dig.
    globals: false,
    environmentMatchGlobs: [
      ["tests/**/jsdom*.test.js", "jsdom"],
      ["tests/**/*-jsdom*.test.js", "jsdom"],
    ],
  },
});
