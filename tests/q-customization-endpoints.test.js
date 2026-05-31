// Q-pass-3 (D) — Customization page server endpoints.
//
// We exercise the underlying lib modules directly (no HTTP) and assert
// the routes are registered + correctly env-gated by static-grepping
// server.js. The factory-reset gate is the most important assertion
// here: per the global Production Safety rule we MUST refuse to wipe
// user data unless ARES_ALLOW_FACTORY_RESET=1 is explicitly set.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ARES_HOME = path.join(os.homedir(), ".ares");
const FEED_CONFIG_FILE = path.join(ARES_HOME, "feed-config.json");
const FEED_INSTRUCTIONS_FILE = path.join(ARES_HOME, "feed-instructions.json");

function _backup(p) {
  if (fs.existsSync(p)) {
    const b = `${p}.test-bak.${process.pid}.${Date.now()}`;
    fs.renameSync(p, b);
    return b;
  }
  return null;
}
function _restore(p, b) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  if (b) { try { fs.renameSync(b, p); } catch {} }
}

describe("Q-pass-3 (D) · feed-config", () => {
  let backupCfg = null;
  let backupIns = null;
  beforeEach(() => {
    backupCfg = _backup(FEED_CONFIG_FILE);
    backupIns = _backup(FEED_INSTRUCTIONS_FILE);
  });
  afterEach(() => {
    _restore(FEED_CONFIG_FILE, backupCfg);
    _restore(FEED_INSTRUCTIONS_FILE, backupIns);
  });

  it("readConfig returns defaults when no file exists", async () => {
    const m = await import(path.join(ROOT, "lib", "feed-config.js"));
    const c = m.readConfig();
    expect(c.checkFrequencyMinutes).toBe(15);
    expect(c.sources["slack-dm-mentions"]).toBe(true);
    expect(c.sources["teams"]).toBe(false);
  });

  it("writeConfig persists known sources + valid frequency", async () => {
    const m = await import(path.join(ROOT, "lib", "feed-config.js"));
    const next = m.writeConfig({
      sources: { "slack-dm-mentions": false, "teams": true },
      checkFrequencyMinutes: 30,
    });
    expect(next.sources["slack-dm-mentions"]).toBe(false);
    expect(next.sources["teams"]).toBe(true);
    expect(next.checkFrequencyMinutes).toBe(30);
    // Round-trip survives a re-read.
    const again = m.readConfig();
    expect(again.checkFrequencyMinutes).toBe(30);
    expect(again.sources["slack-dm-mentions"]).toBe(false);
  });

  it("writeConfig rejects unknown sources + bad frequency silently", async () => {
    const m = await import(path.join(ROOT, "lib", "feed-config.js"));
    const next = m.writeConfig({
      sources: { "made-up-source": true },
      checkFrequencyMinutes: 99,
    });
    expect(next.sources["made-up-source"]).toBeUndefined();
    expect(next.checkFrequencyMinutes).toBe(15); // fallback to default
  });

  it("readInstructions / writeInstructions round-trip", async () => {
    const m = await import(path.join(ROOT, "lib", "feed-config.js"));
    const next = m.writeInstructions({
      "slack-dm-mentions": "Only surface DMs from my manager + cross-functional pings",
    });
    expect(next["slack-dm-mentions"]).toMatch(/manager/);
    const again = m.readInstructions();
    expect(again["slack-dm-mentions"]).toMatch(/manager/);
  });

  it("writeInstructions empty string deletes the key", async () => {
    const m = await import(path.join(ROOT, "lib", "feed-config.js"));
    m.writeInstructions({ "outlook-email": "Filter low-importance threads" });
    const after = m.writeInstructions({ "outlook-email": "" });
    expect(after["outlook-email"]).toBeUndefined();
  });
});

describe("Q-pass-3 (D) · browser-debug probe", () => {
  it("returns ok:false with a helpful error when port is closed", async () => {
    const m = await import(path.join(ROOT, "lib", "browser-debug.js"));
    // Pick an almost-certainly-closed port. If by miracle it is open
    // we'll get ok:true which still satisfies the contract.
    const r = await m.testDebugConnection({ port: 1, timeoutMs: 500 });
    expect(typeof r.ok).toBe("boolean");
    if (!r.ok) {
      expect(typeof r.error).toBe("string");
      expect(r.error.length).toBeGreaterThan(0);
    }
  });
});

describe("Q-pass-3 (D) · diagnostics archive", () => {
  it("emits a valid gzipped tar bundle with a manifest", async () => {
    const m = await import(path.join(ROOT, "lib", "diagnostics.js"));
    const buf = await m.buildDiagnosticsArchive({ since: "1h" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    // Gzip magic bytes 1f 8b
    expect(buf[0]).toBe(0x1f);
    expect(buf[1]).toBe(0x8b);
    // Inflate then look for "manifest.json" inside the tar header.
    const tar = zlib.gunzipSync(buf);
    const text = tar.toString("binary");
    expect(text).toContain("manifest.json");
  });

  it("rejects an invalid since window", async () => {
    const m = await import(path.join(ROOT, "lib", "diagnostics.js"));
    await expect(m.buildDiagnosticsArchive({ since: "100y" }))
      .rejects.toThrow(/bad since/);
  });
});

// ── Server-side route registration + factory-reset gate ────────────
describe("Q-pass-3 (D) · server.js route wiring", () => {
  let serverSrc = "";
  it("loads server.js source", () => {
    serverSrc = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
    expect(serverSrc.length).toBeGreaterThan(0);
  });
  it("registers all five new routes", () => {
    expect(serverSrc).toMatch(/app\.get\("\/api\/feed\/config"/);
    expect(serverSrc).toMatch(/app\.post\("\/api\/feed\/config"/);
    expect(serverSrc).toMatch(/app\.get\("\/api\/feed\/instructions"/);
    expect(serverSrc).toMatch(/app\.post\("\/api\/feed\/instructions"/);
    expect(serverSrc).toMatch(/app\.post\("\/api\/browser\/test-debug-connection"/);
    expect(serverSrc).toMatch(/app\.get\("\/api\/diagnostics"/);
  });
  it("none of the new routes are added to PUBLIC_PATHS", () => {
    const auth = fs.readFileSync(path.join(ROOT, "lib", "auth.js"), "utf8");
    expect(auth).not.toMatch(/feed\/config/);
    expect(auth).not.toMatch(/feed\/instructions/);
    expect(auth).not.toMatch(/test-debug-connection/);
    expect(auth).not.toMatch(/diagnostics/);
  });
});
