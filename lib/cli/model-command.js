// `ares model` — list available Bedrock Claude models from the registry.

import { MODELS } from "../llm/model-registry.js";

export async function runModelCommand(_opts = {}) {
  console.log("Available models (all on Bedrock, profile your-aws-profile, us-west-2):");
  console.log("");
  for (const m of MODELS) {
    if (m.id === "auto") continue;
    console.log(`  ${m.icon || " "} ${m.name.padEnd(12)} ${m.id}`);
    console.log(`     ${m.description}`);
    console.log(`     tier=${m.tier}  maxTokens=${m.maxTokens || "?"}${m.noTemperature ? "  (no temperature)" : ""}`);
    console.log("");
  }
  console.log("Set ARES_MODEL_ID or pass --model <id> to override the default.");
  return 0;
}
