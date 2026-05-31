// Phase U09 — sandbox backend ABC.
//
// Default backend is `local` — a passthrough that just forwards to the
// existing shell-agent MCP (no isolation, no behavioural change). The
// `docker` backend executes each shell command in an ephemeral container
// with a tmpfs work dir.
//
// ARES_SANDBOX=local|docker selects at boot. Unknown values fall back to
// local with a warning so a typo doesn't break shell access.
//
// We do NOT add Modal / Daytona / SSH / Vercel / Singularity backends —
// the upgrade plan is explicit about that. The factory's allowlist below
// is the only acceptance gate.

export class SandboxBackend {
  /** Identifier surfaced via /api/health and the header chip. */
  get name() { return "base"; }

  /** Free-form description for the doctor probe (Phase U18). */
  get description() { return "abstract base — never used directly"; }

  /**
   * Run a shell command. Returns { stdout, stderr, exitCode, durationMs }.
   * Throw on infrastructure errors (e.g. docker daemon missing) — the hub
   * surfaces those as MCP errors with isError:true.
   *
   * @param {object} opts
   * @param {string} opts.command  — the full shell command line
   * @param {string} [opts.cwd]    — working directory (local backend only)
   * @param {number} [opts.timeout] — ms; fallback default per-backend
   * @param {AbortSignal} [opts.abortSignal]
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number, durationMs: number}>}
   */
  async exec(_opts) {
    throw new Error(`SandboxBackend.exec() not implemented for ${this.name}`);
  }

  /**
   * Best-effort warm check — used by the doctor probe to flag unhealthy
   * backends (e.g. docker daemon down). Returns { ok, info? }.
   */
  async health() {
    return { ok: true };
  }
}
