// Phase RP1-B2 — auto-recorder eligibility gate.
//
// Standalone predicate used by server.js's auto-record path. Lives here
// (not inline in server.js) so tests can exercise it without booting
// the whole Express app.
//
// A run is auto-recorder-eligible only when:
//   - it did NOT terminate with a Bedrock credential error,
//   - the most recent assistant turn carries genuine text content,
//   - that text doesn't START with one of the canonical error
//     preambles ("Bedrock error:", "Bedrock prompt-too-long:",
//     "isengardcli", "auth-init").
//
// Returns true → auto-record proceeds. False → skip.

const ERROR_PREAMBLE_RE = /^Bedrock (?:error|prompt-too-long)|isengardcli|auth-init/i;

/**
 * Pull the most recent assistant text from finalMessages. Walks
 * backwards; tolerates string-content and array-of-blocks content.
 * Returns "" when nothing usable is found.
 */
export function lastAssistantTextFromMessages(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "assistant") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      const t = m.content.filter((b) => b?.type === "text").map((b) => b.text || "").join("");
      if (t.trim()) return t;
    }
    return "";
  }
  return "";
}

/**
 * The gate. Pass `{sawCredentialError, finalMessages}` and get a bool
 * back. The verdict carries no side effects — the caller decides
 * what to do with a false return (typically: skip memory_record).
 */
export function isAutoRecorderEligible({ sawCredentialError = false, finalMessages = [] } = {}) {
  if (sawCredentialError) return false;
  const t = lastAssistantTextFromMessages(finalMessages).trim();
  if (!t) return false;
  if (ERROR_PREAMBLE_RE.test(t.slice(0, 200))) return false;
  return true;
}

export const _internals = { ERROR_PREAMBLE_RE };
