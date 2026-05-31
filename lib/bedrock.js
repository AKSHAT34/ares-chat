// Re-export shim — Phase U02.
//
// The Bedrock driver moved to lib/llm/bedrock-driver.js. This file stays as
// a re-export so existing imports (`from "./lib/bedrock.js"` in agent.js,
// orchestrator.js, server.js, memory-hooks.js, jobs handlers, tests) keep
// working without churn. New code should import from lib/llm/bedrock-driver.js
// directly.

export {
  BedrockClaude,
  BedrockCredentialError,
  classifyCredentialError,
  peekCredentials,
  refreshCredentials,
  makeBedrockDriver,
} from "./llm/bedrock-driver.js";
