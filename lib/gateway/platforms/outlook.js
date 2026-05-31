// Example gateway platform adapter — "outlook".
//
// This is a STUB demonstrating the platform interface the GatewayManager
// expects. Wire it up to a real email MCP by implementing pollForMail to
// fetch fresh unread messages.
//
// Each platform module must export:
//   - pollForMail(opts)    → Promise<Array<{ key, platform, target, threadKey, fromUser, text }>>
//   - markDelivered(key)   → mark a seen message as successfully answered
//   - markFailed(key)      → mark a seen message as failed
//   - _resetSeenForTests() → clear the seen-set (tests only)

const SEEN = new Set();
const IN_FLIGHT = new Set();

/**
 * Poll the platform for fresh inbound mail.
 * Stub: returns nothing. Implement against your email MCP.
 * @returns {Promise<Array>}
 */
export async function pollForMail(_opts = {}) {
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
