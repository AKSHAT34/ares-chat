// Re-export shim — Phase U02.
//
// The model registry moved to lib/llm/model-registry.js. This file stays as
// a re-export so existing imports (`from "./lib/models.js"` in server.js,
// public-facing tooling) keep working without churn. New code should import
// from lib/llm/model-registry.js directly.

export {
  MODELS,
  getModel,
  listModels,
  pickByTier,
  autoRoute,
} from "./llm/model-registry.js";
