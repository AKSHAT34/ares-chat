// Bedrock model registry — single source of truth for which Claude models
// ares-chat may invoke.
//
// Moved from lib/models.js in Phase U02. The original file now re-exports
// from here so existing imports keep working. Every entry here must be a
// real Bedrock inference profile reachable on the your-aws-profile account
// (YOUR_ACCOUNT_ID) in us-west-2. New models go in MODELS; route hints go
// in autoRoute().
//
// Tier semantics:
//   "haiku"  — small/fast/cheap. Decomposition, classification, lookups.
//   "sonnet" — workhorse. Tool use, analysis, multi-step.
//   "opus"   — heavy reasoning. Long context, code gen, cross-doc synthesis.
//   "auto"   — UI sentinel; the agent picks via autoRoute().

export const MODELS = [
  {
    id: "auto",
    name: "Auto",
    description: "Routes to the best model based on task complexity",
    tier: "auto",
    icon: "⚡",
  },
  {
    id: "us.anthropic.claude-opus-4-8",
    name: "Opus 4.8",
    description: "Newest + most capable — complex reasoning, long context, code gen (1M context)",
    tier: "opus",
    icon: "🧠",
    maxTokens: 16384,
    noTemperature: true,
  },
  {
    id: "us.anthropic.claude-opus-4-7",
    name: "Opus 4.7",
    description: "Most capable — complex reasoning, long context, code gen",
    tier: "opus",
    icon: "🧠",
    maxTokens: 16384,
    noTemperature: true,
  },
  {
    id: "us.anthropic.claude-sonnet-4-20250514",
    name: "Sonnet 4.6",
    description: "Fast + capable — multi-step tool use, analysis",
    tier: "sonnet",
    icon: "⚙️",
    maxTokens: 8192,
  },
  {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    name: "Haiku 4.5",
    description: "Fastest + cheapest — simple Q&A, classification, routing",
    tier: "haiku",
    icon: "💨",
    maxTokens: 4096,
  },
  {
    id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Sonnet 4.5",
    description: "Extended thinking — deep analysis, research",
    tier: "sonnet",
    icon: "🔬",
    maxTokens: 8192,
  },
  {
    id: "us.anthropic.claude-opus-4-6-v1",
    name: "Opus 4.6",
    description: "Previous-gen opus — strong reasoning",
    tier: "opus",
    icon: "🧠",
    maxTokens: 8192,
    noTemperature: true,
  },
];

/**
 * Return the model entry for an id, or the first entry (the "auto" sentinel)
 * when nothing matches. Never throws — callers can assume a non-null result.
 */
export function getModel(id) {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

/**
 * List every concrete (non-"auto") model. Useful for the CLI's `model`
 * subcommand and the tray's "Model" submenu (Phase 21).
 */
export function listModels() {
  return MODELS.filter((m) => m.id !== "auto");
}

/**
 * Pick a default model id for a tier ("haiku" | "sonnet" | "opus"). Returns
 * the id of the *latest* model in that tier — the registry order matters.
 */
export function pickByTier(tier) {
  const t = (tier || "").toLowerCase();
  for (const m of MODELS) {
    if (m.id === "auto") continue;
    if (m.tier === t) return m.id;
  }
  // Fallback: workhorse Sonnet.
  return "us.anthropic.claude-sonnet-4-20250514";
}

/**
 * Auto-route: given the user's message + attachments, decide which model to use.
 * Uses heuristics (no LLM call needed — saves latency + cost):
 *
 * Opus: complex multi-step tasks, code generation, long documents, research,
 *       cross-doc analysis, large attachments (pageindex-eligible)
 * Sonnet: tool-use tasks, analysis, moderate complexity
 * Haiku: simple Q&A, memory lookups, one-shot answers, classification
 *
 * `attachments` may be either a count (legacy) or an array of attachment
 * metadata objects with at least { sizeBytes, mime, name }.
 */
export function autoRoute(message, attachments = 0) {
  const msg = (message || "").toLowerCase();
  const len = msg.length;

  const attArr = Array.isArray(attachments) ? attachments : [];
  const attCount = Array.isArray(attachments) ? attachments.length : (attachments | 0);

  const LARGE_FILE_BYTES = 250 * 1024;
  const HUGE_FILE_BYTES = 2 * 1024 * 1024;
  const totalAttachmentBytes = attArr.reduce((n, a) => n + (a?.sizeBytes || 0), 0);
  const largeFileCount = attArr.filter((a) => (a?.sizeBytes || 0) >= LARGE_FILE_BYTES).length;
  const hasHugeFile = attArr.some((a) => (a?.sizeBytes || 0) >= HUGE_FILE_BYTES);
  const pageindexEligible =
    attCount >= 3 ||
    largeFileCount >= 1 ||
    totalAttachmentBytes >= 750 * 1024;

  const opusSignals = [
    len > 800,
    attCount >= 2,
    /\b(research|analyze|analyse|compare|deep.?dive|investigate|audit|review all|comprehensive)\b/.test(msg),
    /\b(write|create|build|implement|refactor|architect)\b.*\b(code|script|function|class|module|system)\b/.test(msg),
    /\b(plan|strategy|proposal|report|document)\b/.test(msg),
    /\b(parallel|multi.?step|end.?to.?end|full|complete)\b/.test(msg),
    /\b(across (these |all |the )?(files?|documents?|pdfs?|sheets?|excels?|csvs?))\b/.test(msg),
    /\b(extract|summarise|summarize) (from|across) /.test(msg),
  ];

  const haikuSignals = [
    len < 80,
    /^(what|who|when|where|how much|how many|is |are |does |did |can )/i.test(msg),
    /\b(list|show|tell me|remind me|what's my|check)\b/.test(msg) && len < 200,
    /\b(memory|preference|name|status)\b/.test(msg) && len < 150,
  ];

  const opusScore = opusSignals.filter(Boolean).length;
  const haikuScore = haikuSignals.filter(Boolean).length;

  if (hasHugeFile || attCount >= 3) {
    return "us.anthropic.claude-opus-4-8";
  }
  if (pageindexEligible && opusScore >= 1) {
    return "us.anthropic.claude-opus-4-8";
  }
  if (pageindexEligible) {
    return "us.anthropic.claude-sonnet-4-20250514";
  }

  if (opusScore >= 2) return "us.anthropic.claude-opus-4-8";
  if (haikuScore >= 2 && opusScore === 0) return "us.anthropic.claude-haiku-4-5-20251001-v1:0";
  return "us.anthropic.claude-sonnet-4-20250514";
}
