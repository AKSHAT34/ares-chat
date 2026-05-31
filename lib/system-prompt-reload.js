// Q-pass-4 (work-stream E) — hot-reload the system prompt.
//
// /api/system-prompt/reload rebuilds the system prompt from disk +
// the live MCP catalog and updates the per-session cached copies in
// memory. After this runs, every subsequent /api/chat dispatch on the
// listed sessions assembles its claudeMessages with the freshly built
// systemPrompt — no server restart required.
//
// Body shape:
//   { sessionIds?: string[] }   // omit to reload for ALL sessions
//
// Response:
//   { reloaded: <count>, errors: [{ sessionId, error }] }
//
// Implementation note: the chat server stores the system prompt as
// a single module-level variable and re-uses it across all sessions.
// Per-session caching isn't a thing yet — but this module is written
// as if it WERE, so when we add per-session prompts later (e.g. for
// session-specific personas) the API stays stable. For now it just
// rebuilds the global and reports a count of "affected sessions" =
// either the requested set or every session in the in-memory map.

import { buildSystemPrompt } from "./system-prompt.js";

/**
 * Rebuild the system prompt and refresh in-memory caches.
 *
 * @param {object} opts
 * @param {Map<string, any>} opts.sessions  — server.js's sessions map
 * @param {object} opts.hub                  — McpHub instance
 * @param {string} opts.workspaceRoot
 * @param {string[]} [opts.sessionIds]       — restrict to specific sessions
 * @param {(s:string)=>any} [opts.applyPrompt] — optional hook called per
 *        session id with the freshly-built prompt; lets server.js write
 *        through to a per-session cache once we add one.
 *
 * @returns {Promise<{reloaded:number, errors:Array, length:number}>}
 */
export async function reloadSystemPrompt({
  sessions,
  hub,
  workspaceRoot,
  sessionIds,
  applyPrompt,
}) {
  const errors = [];
  let prompt = "";
  try {
    const mcpCatalog = hub?.listServers ? hub.listServers() : "";
    prompt = await buildSystemPrompt({ workspaceRoot, mcpCatalog });
  } catch (e) {
    return { reloaded: 0, errors: [{ sessionId: null, error: e.message }], length: 0 };
  }

  // Determine which sessions are in scope.
  const ids = Array.isArray(sessionIds) && sessionIds.length
    ? sessionIds
    : (sessions ? [...sessions.keys()] : []);

  let reloaded = 0;
  for (const sid of ids) {
    try {
      // If the caller wired up per-session caching, write through.
      if (typeof applyPrompt === "function") {
        applyPrompt(sid, prompt);
      }
      reloaded += 1;
    } catch (e) {
      errors.push({ sessionId: sid, error: e?.message || String(e) });
    }
  }

  return { reloaded, errors, length: prompt.length, prompt };
}
