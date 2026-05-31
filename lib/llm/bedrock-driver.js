// Bedrock Claude driver — the single LLM transport for ares-chat.
//
// Moved from lib/bedrock.js in Phase U02 (Bedrock-only model layer). The
// original file now re-exports from here so existing imports
// (`from "./lib/bedrock.js"`) keep working without churn. There is
// intentionally NO LlmProvider abstraction over this module — Bedrock
// on the your-aws-profile profile is the ONLY supported path. If you ever
// need a different provider, add a sibling driver here, do not generalise.
//
// What lives here:
//   - BedrockClaude       — invoke() + stream() against Bedrock Anthropic 2023-05-31
//   - BedrockCredentialError — typed error so the UI can show "run auth-init" hints
//   - peekCredentials()   — read cached creds without forcing a refresh
//   - refreshCredentials()— force re-resolve (drops the cached entry)
//
// Credential cache strategy: the AWS SDK is handed a *provider function*,
// not resolved creds. The provider is invoked on every request, hits a
// module-level cache, and forces a re-resolve when within 5 min of expiry.
// Without this, STS tokens (~1h on your-aws-profile) would expire mid long-run
// and every send after that would throw ExpiredTokenException.

import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { stampSystem, stampTools, recordUsage, maybeAutoDisable } from "./prompt-cache.js";

const CREDENTIAL_SKEW_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const credentialCache = new Map(); // profileKey -> { creds, resolvedAt }

function makeRefreshingProvider(profile) {
  const profileKey = profile || "__default__";
  return async () => {
    const now = Date.now();
    const cached = credentialCache.get(profileKey);
    if (cached && cached.creds.expiration instanceof Date) {
      const msToExpiry = cached.creds.expiration.getTime() - now;
      if (msToExpiry > CREDENTIAL_SKEW_MS) {
        return cached.creds;
      }
      const minsLeft = Math.round(msToExpiry / 60000);
      console.log(`[creds] refreshing ${profileKey} (${minsLeft} min to expiry)`);
    } else if (cached) {
      console.log(`[creds] refreshing ${profileKey} (no expiration on cached creds)`);
    } else {
      console.log(`[creds] first resolve for ${profileKey}`);
    }
    const base = fromNodeProviderChain(profile ? { profile } : {});
    const fresh = await base();
    credentialCache.set(profileKey, { creds: fresh, resolvedAt: now });
    return fresh;
  };
}

/**
 * Peek at the current cached credentials without triggering a refresh.
 * Used by the agent to decide whether to proactively re-resolve before
 * starting a new stream() call. Returns {valid, minutesLeft, profile}.
 */
export function peekCredentials(profile) {
  const profileKey = profile || "__default__";
  const cached = credentialCache.get(profileKey);
  if (!cached || !cached.creds?.expiration) {
    return { valid: false, minutesLeft: 0, profile: profileKey, reason: "no-cache" };
  }
  const minutesLeft = Math.round((cached.creds.expiration.getTime() - Date.now()) / 60000);
  return {
    valid: minutesLeft > 0,
    minutesLeft,
    profile: profileKey,
  };
}

/**
 * Force an immediate re-resolve of the credential chain for the given
 * profile. Called by the agent's pre-stream liveness check when creds
 * are within 2 min of expiry, and by the server's warmup timer.
 */
export async function refreshCredentials(profile) {
  const profileKey = profile || "__default__";
  credentialCache.delete(profileKey); // force bypass of the skew check
  const provider = makeRefreshingProvider(profile);
  return provider();
}

/**
 * Custom error class tagged as a credential problem so the agent/server
 * can surface it distinctly to the UI (with an actionable "run auth-init"
 * hint) instead of a generic red box.
 */
export class BedrockCredentialError extends Error {
  constructor(message, { reason = "unknown", originalMessage = "" } = {}) {
    super(message);
    this.name = "BedrockCredentialError";
    this.isCredentialError = true;
    this.reason = reason; // "expired" | "missing" | "auth-provider-required" | "unknown"
    this.originalMessage = originalMessage;
    this.needsAuth = true;
  }
}

// Detect the grab-bag of error shapes AWS / isengardcli surfaces when a
// AuthProvider token has expired. Returns a BedrockCredentialError or null.
export function classifyCredentialError(err) {
  if (!err) return null;
  const name = err.name || "";
  const code = err.Code || err.code || "";
  const msg = (err.message || "").toString();

  // Isengard custom credential_process stderr, propagated by
  // @aws-sdk/credential-providers when its child process fails.
  if (/You need to authenticate with AuthProvider/i.test(msg) ||
      /Run the following command.*auth-init/i.test(msg)) {
    return new BedrockCredentialError(
      "AWS credentials expired — run `auth-init -s` in a terminal, then retry.",
      { reason: "auth-provider-required", originalMessage: msg }
    );
  }

  // Generic provider-chain failure ("Could not load credentials from any providers").
  if (name === "CredentialsProviderError" ||
      /Could not load credentials from any providers/i.test(msg) ||
      /Credential is missing/i.test(msg)) {
    return new BedrockCredentialError(
      "AWS credentials could not be loaded — run `auth-init -s`, then retry.",
      { reason: "missing", originalMessage: msg }
    );
  }

  // STS / session token expired.
  if (name === "ExpiredTokenException" || name === "ExpiredToken" ||
      code === "ExpiredToken" || code === "ExpiredTokenException" ||
      /ExpiredToken/i.test(msg) || /The security token included in the request is expired/i.test(msg)) {
    return new BedrockCredentialError(
      "AWS session token expired — run `auth-init -s`, then retry.",
      { reason: "expired", originalMessage: msg }
    );
  }

  // Access denied / forbidden that looks creds-related (role-trust issues).
  if ((name === "AccessDeniedException" || /403/.test(err.$metadata?.httpStatusCode || "")) &&
      /assume|role|credential/i.test(msg)) {
    return new BedrockCredentialError(
      "AWS access denied — run `auth-init -s` to refresh Isengard credentials, then retry.",
      { reason: "expired", originalMessage: msg }
    );
  }

  return null;
}

export class BedrockClaude {
  constructor({ modelId, region = "us-west-2", profile }) {
    this.modelId = modelId;
    this.region = region;
    this.profile = profile || null;
    this.client = new BedrockRuntimeClient({
      region,
      credentials: makeRefreshingProvider(profile),
      maxAttempts: 3,
      retryMode: "adaptive",
    });
  }

  // Indirection so RP1-B2 resume tests can stub credential refresh
  // without monkey-patching the module export.
  async _refreshCredentials() {
    return refreshCredentials(this.profile);
  }

  /**
   * Non-streaming single turn. Used by the agent loop because tool_use
   * streaming is more complex and we don't need it for correctness — we
   * just stream assistant *text* back to the UI ourselves between turns.
   *
   * body = { system, messages, tools, max_tokens, temperature }
   */
  async invoke(body, { abortSignal } = {}) {
    // Phase U04 — wrap payload build in a closure so the auto-disable retry
    // path can rebuild it after the cache flips off.
    const buildPayload = () => {
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: body.max_tokens ?? 4096,
        // Stamp cache_control on the static system prompt + the last tool
        // when caching is enabled. Stamping no-ops if disabled.
        system: stampSystem(body.system),
        messages: body.messages,
      };
      // Opus 4.7 + 4.8 reject `temperature`; other models accept it.
      if (body.temperature != null && !/opus-4-[78]/.test(this.modelId)) {
        payload.temperature = body.temperature;
      }
      if (body.tools && body.tools.length) {
        payload.tools = stampTools(body.tools);
        payload.tool_choice = { type: "auto" };
      }
      return payload;
    };

    const callOnce = async () => {
      const cmd = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(buildPayload()),
      });
      const res = await this.client.send(cmd, abortSignal ? { abortSignal } : undefined);
      const text = new TextDecoder().decode(res.body);
      const parsed = JSON.parse(text);
      // Surface usage for the cache hit/miss counters.
      try { recordUsage(parsed?.usage); } catch {}
      return parsed;
    };

    try {
      return await callOnce();
    } catch (err) {
      // Auto-disable: if cache_control was the offender, flip cache off
      // for the rest of the process and retry once without stamping.
      if (maybeAutoDisable(err)) {
        try { return await callOnce(); } catch (retryErr) {
          const credErr = classifyCredentialError(retryErr);
          if (credErr) throw credErr;
          throw retryErr;
        }
      }
      const credErr = classifyCredentialError(err);
      if (credErr) throw credErr;
      throw err;
    }
  }

  /**
   * Streaming variant. Yields incremental events matching the Anthropic
   * Messages API streaming schema:
   *   - { type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | ... }
   * The caller accumulates tool_use blocks and text deltas.
   */
  async *stream(body, { abortSignal } = {}) {
    // Phase U04 — same payload-builder + auto-disable retry pattern as
    // invoke(). Streaming responses carry usage stats on the
    // `message_start` event and again on `message_delta` (final tally),
    // so we record both as they arrive.
    const buildPayload = () => {
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: body.max_tokens ?? 4096,
        system: stampSystem(body.system),
        messages: body.messages,
      };
      if (body.temperature != null && !/opus-4-[78]/.test(this.modelId)) {
        payload.temperature = body.temperature;
      }
      if (body.tools && body.tools.length) {
        payload.tools = stampTools(body.tools);
        payload.tool_choice = { type: "auto" };
      }
      return payload;
    };

    const openStream = async () => {
      const cmd = new InvokeModelWithResponseStreamCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(buildPayload()),
      });
      return this.client.send(cmd, abortSignal ? { abortSignal } : undefined);
    };

    let res;
    try {
      res = await openStream();
    } catch (err) {
      if (err?.name === "AbortError" || abortSignal?.aborted) {
        const e = new Error("Aborted by client");
        e.name = "AbortError";
        throw e;
      }
      // Cache-rejection auto-disable: retry once without stamping.
      if (maybeAutoDisable(err)) {
        try { res = await openStream(); } catch (retryErr) {
          if (retryErr?.name === "AbortError" || abortSignal?.aborted) {
            const e = new Error("Aborted by client");
            e.name = "AbortError";
            throw e;
          }
          const credErr = classifyCredentialError(retryErr);
          if (credErr) throw credErr;
          throw retryErr;
        }
      } else {
        const credErr = classifyCredentialError(err);
        if (credErr) throw credErr;
        throw err;
      }
    }
    // Phase RP1-B2 — mid-stream credential refresh + resume.
    //
    // STS tokens expire on the 1h boundary; long agent turns regularly
    // cross that boundary. Without resume, the chunk loop catches the
    // ExpiredTokenException, the run dies with `kind:"credentials"`,
    // and the auto-recorder ingests the resulting empty turn as a junk
    // memory entry.
    //
    // Resume protocol:
    //   1. Catch credential errors *during* chunk iteration.
    //   2. Refresh STS via the same path agent.js uses pre-stream.
    //   3. Re-issue the SAME command and continue yielding chunks. The
    //      caller sees a single seamless stream — Bedrock starts the
    //      message over from message_start, but our caller's accumulator
    //      logic is keyed on tool_use / text_delta block ids, so a
    //      replayed message just refines the partial state. We track
    //      a counter so we don't loop forever.
    //   4. After RESUME_BUDGET attempts give up and rethrow as a
    //      structured BedrockCredentialError so the existing UI banner
    //      fires (AuthProvider is genuinely expired — needs `auth-init -s`).
    const RESUME_BUDGET = 2;
    let resumesUsed = 0;

    while (true) {
      let resumeRequested = false;
      try {
        for await (const chunk of res.body) {
          if (abortSignal?.aborted) {
            const e = new Error("Aborted by client");
            e.name = "AbortError";
            throw e;
          }
          if (!chunk.chunk?.bytes) continue;
          const json = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          if (json?.type === "message_start" && json.message?.usage) {
            try { recordUsage(json.message.usage); } catch {}
          }
          yield json;
        }
        // Stream completed cleanly.
        return;
      } catch (err) {
        if (err?.name === "AbortError" || abortSignal?.aborted) throw err;
        const credErr = classifyCredentialError(err);
        if (credErr && resumesUsed < RESUME_BUDGET) {
          resumesUsed += 1;
          // Force a fresh STS resolve via the same path agent.js uses
          // pre-stream. If this throws, the catch falls through to the
          // structured rethrow below.
          try {
            await this._refreshCredentials();
          } catch (refreshErr) {
            throw classifyCredentialError(refreshErr) || credErr;
          }
          // Re-open the stream and continue yielding. Yield a sentinel
          // event the agent loop can observe (no client work needed —
          // the existing event consumer ignores unknown types) for
          // observability.
          yield { type: "credentials_refreshing", phase: "mid-stream", attempt: resumesUsed };
          try {
            res = await openStream();
          } catch (reopenErr) {
            const re = classifyCredentialError(reopenErr) || reopenErr;
            throw re;
          }
          // B-1: emit a reset sentinel BEFORE the fresh stream replays
          // message_start. The agent loop's content accumulators
          // (assistantContent, currentBlock, currentToolInputJson,
          // textDeltaBytesThisIter) must drop everything they collected
          // pre-refresh; the fresh stream restarts the message from
          // scratch. Without this reset, every text_delta double-yields
          // and tool_use blocks dispatch twice.
          yield { type: "_resume_reset", attempt: resumesUsed };
          resumeRequested = true;
          continue; // back to the for-await
        }
        if (credErr) throw credErr;
        throw err;
      }
      // Defensive — if we exit the inner try without `return` AND
      // didn't request a resume, something is wrong. Bail.
      if (!resumeRequested) return;
    }
  }
}

// Re-export the prompt-cache surface so callers that already import from
// the driver (server.js for /api/health, audit gate) can get cache state
// without a second import. Keeps the public surface tight.
export { isCacheEnabled, cacheStatus, recordUsage } from "./prompt-cache.js";

/**
 * Factory for callers that want a fresh driver without mucking with the
 * BedrockClaude constructor shape directly. Mirrors what server.js's
 * `bedrockFactory` does — kept here so subagents (Phase 5) and the CLI
 * (Phase 7a) can import a single named entry point.
 */
export function makeBedrockDriver({ modelId, region = "us-west-2", profile }) {
  return new BedrockClaude({ modelId, region, profile });
}
