// Example gateway platform adapter — "slack".
//
// This is a STUB demonstrating the platform interface the GatewayManager
// expects. Wire it up to a real chat MCP (e.g. a Slack MCP server) by
// implementing pollForMentions to fetch fresh inbound messages.
//
// Each platform module must export:
//   - pollForMentions(opts) → Promise<Array<{ key, platform, target, threadKey, fromUser, text }>>
//   - markDelivered(key)    → mark a seen message as successfully answered
//   - markFailed(key)       → mark a seen message as failed
//   - _resetSeenForTests()  → clear the seen-set (tests only)

const SEEN = new Set();
const IN_FLIGHT = new Set();

/**
 * Poll the platform for fresh inbound messages.
 * Stub: returns nothing. Implement against your chat MCP.
 * @returns {Promise<Array>}
 */
export async function pollForMentions(_opts = {}) {
  return [];
}

export function markDelivered(key) {
  IN_FLIGHT.delete(key);
  SEEN.add(key);
}

export function markFailed(key) {
  IN_FLIGHT.delete(key);
}

export function _resetSeenForTests() {
  SEEN.clear();
  IN_FLIGHT.clear();
}
