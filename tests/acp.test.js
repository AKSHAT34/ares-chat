// Phase U07b — ACP adapter tests.
//
// Spawn `node bin/ares.js acp` as a child process and exchange JSON-RPC
// messages over its stdin/stdout. Tests cover the message shape contract
// — initialize, list_tools, cancel-without-run, approve_diff routing,
// invalid JSON handling. We do NOT test send_user_message end-to-end
// because that calls Bedrock and would slow CI to ~5-15s per test.
//
// Boot timeout is generous because the child has to spawn 5 Tier-1 MCPs
// on cold start (≈3-5s on this machine).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN = path.join(ROOT, "bin", "ares.js");

class AcpClient {
  constructor() {
    this.child = spawn(process.execPath, [BIN, "acp"], {
      cwd: ROOT,
      env: { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE || "your-aws-profile" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this._buf = "";
    this._pending = new Map();
    this._notifications = [];
    this._readyMessage = null;
    this._readyPromise = new Promise((resolve, reject) => {
      this._readyResolve = resolve;
      this._readyReject = reject;
    });
    this._nextId = 1;

    this.child.stdout.on("data", (chunk) => this._absorb(chunk));
    this.child.stderr.on("data", (chunk) => {
      // Useful when debugging a failing test; uncomment to inspect.
      // process.stderr.write("[acp-child] " + chunk);
    });
    this.child.on("exit", (code) => {
      if (this._readyResolve) this._readyReject(new Error(`child exited before ready (code=${code})`));
    });
  }

  _absorb(chunk) {
    this._buf += chunk.toString("utf8");
    let nl;
    while ((nl = this._buf.indexOf("\n")) !== -1) {
      const line = this._buf.slice(0, nl).trim();
      this._buf = this._buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg?.method === "ready") {
        this._readyMessage = msg;
        if (this._readyResolve) {
          this._readyResolve(msg);
          this._readyResolve = null;
          this._readyReject = null;
        }
        continue;
      }
      if (msg.id != null && this._pending.has(msg.id)) {
        const { resolve, reject } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.code} ${msg.error.message}`));
        else resolve(msg.result);
        continue;
      }
      if (msg.method) {
        this._notifications.push(msg);
      }
    }
  }

  ready() { return this._readyPromise; }

  call(method, params = {}, { timeout = 30_000 } = {}) {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`timeout calling ${method}`));
      }, timeout);
      this._pending.set(id, {
        resolve: (v) => { clearTimeout(t); resolve(v); },
        reject:  (e) => { clearTimeout(t); reject(e); },
      });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  raw(line) {
    this.child.stdin.write(line + "\n");
  }

  notifications() { return this._notifications.slice(); }

  async close() {
    try {
      this.child.stdin.end();
    } catch {}
    // Give the child up to 3s to exit cleanly via shutdown notification it received.
    await new Promise((r) => setTimeout(r, 200));
    if (!this.child.killed) {
      try { this.child.kill("SIGKILL"); } catch {}
    }
  }
}

let client;

beforeAll(async () => {
  client = new AcpClient();
  await client.ready();
}, 30_000);

afterAll(async () => {
  if (client) await client.close();
});

describe("ACP — boot + initialize", () => {
  it("emits ready notification with protocol + agent name on startup", async () => {
    const ready = client._readyMessage;
    expect(ready).toBeTruthy();
    expect(ready.params.agent).toBe("ares-chat");
    expect(ready.params.protocol).toMatch(/^ACP/);
  });

  it("initialize returns capabilities", async () => {
    const result = await client.call("initialize", { clientName: "test" });
    expect(result.agentName).toBe("ares-chat");
    expect(result.capabilities).toMatchObject({
      sendMessage: true,
      cancel: true,
      approve: true,
      listTools: true,
    });
  });
});

describe("ACP — tool listing", () => {
  it("list_tools returns a non-empty array of {name, description}", async () => {
    const r = await client.call("list_tools");
    expect(Array.isArray(r.tools)).toBe(true);
    expect(r.tools.length).toBeGreaterThan(0);
    expect(r.tools[0]).toHaveProperty("name");
    expect(r.tools[0]).toHaveProperty("description");
    // ares_delegate_subagent should be among the meta tools.
    const names = r.tools.map((t) => t.name);
    expect(names).toContain("ares_delegate_subagent");
  });
});

describe("ACP — cancel + approve_diff routing", () => {
  it("cancel for an unknown sessionId returns { cancelled: false }", async () => {
    const r = await client.call("cancel", { sessionId: "ghost-session" });
    expect(r.cancelled).toBe(false);
  });

  it("cancel without sessionId returns -32602 invalid params", async () => {
    await expect(client.call("cancel", {})).rejects.toThrow(/-32602/);
  });

  it("approve_diff for unknown approvalId returns { resolved: false }", async () => {
    const r = await client.call("approve_diff", { approvalId: "no-such-id", decision: "approve" });
    expect(r.resolved).toBe(false);
  });

  it("approve_diff without approvalId or sessionId returns -32602", async () => {
    await expect(client.call("approve_diff", { decision: "approve" })).rejects.toThrow(/-32602/);
  });
});

describe("ACP — error handling", () => {
  it("unknown method returns -32601", async () => {
    await expect(client.call("does_not_exist", {})).rejects.toThrow(/-32601/);
  });

  it("malformed JSON line is silently dropped (no crash, follow-up calls still work)", async () => {
    client.raw("{this is not json");
    // The next legitimate call should still work — child must not have crashed.
    const r = await client.call("initialize", {});
    expect(r.agentName).toBe("ares-chat");
  });
});
