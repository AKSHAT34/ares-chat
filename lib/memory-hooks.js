// Memory hooks — auto-summarize old entries on boot.

/**
 * autoSummarize — consolidates memory entries older than 14 days into
 * weekly summaries. Only summarizes weeks with > 3 entries that haven't
 * already been summarized.
 *
 * @param {object} hub - McpHub instance
 * @param {function} bedrockFactory - factory that returns a BedrockClaude instance
 */
export async function autoSummarize(hub, bedrockFactory) {
  console.log("[memory-hooks] running autoSummarize…");

  let entries;
  try {
    const result = await hub.callTool("memory__memory_recall_recent", { limit: 100 });
    // The result comes back as a content array from MCP; parse it
    const text = typeof result === "string" ? result :
      Array.isArray(result?.content) ? result.content.map((c) => c.text || "").join("") :
      typeof result?.content === "string" ? result.content : JSON.stringify(result);
    entries = JSON.parse(text);
  } catch (err) {
    console.error("[memory-hooks] failed to recall recent entries:", err.message);
    return;
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    console.log("[memory-hooks] no entries to summarize");
    return;
  }

  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const cutoff = now - fourteenDaysMs;

  // Filter entries older than 14 days
  const oldEntries = entries.filter((e) => {
    const ts = e.timestamp || e.createdAt || e.date;
    if (!ts) return false;
    const d = new Date(ts).getTime();
    return d < cutoff;
  });

  if (oldEntries.length === 0) {
    console.log("[memory-hooks] no entries older than 14 days");
    return;
  }

  // Group by ISO week (YYYY-Www)
  const weekGroups = new Map();
  for (const entry of oldEntries) {
    const ts = entry.timestamp || entry.createdAt || entry.date;
    const d = new Date(ts);
    const weekLabel = getISOWeekLabel(d);
    if (!weekGroups.has(weekLabel)) weekGroups.set(weekLabel, []);
    weekGroups.get(weekLabel).push(entry);
  }

  // Check which weeks already have a summary
  const existingSummaryTags = new Set();
  for (const entry of entries) {
    const tags = entry.tags || [];
    if (tags.includes("weekly-summary")) {
      // Find the week label tag
      for (const t of tags) {
        if (/^\d{4}-W\d{2}$/.test(t)) existingSummaryTags.add(t);
      }
    }
  }

  let summarizedCount = 0;
  const haiku = bedrockFactory("us.anthropic.claude-haiku-4-5-20251001-v1:0");

  for (const [weekLabel, weekEntries] of weekGroups) {
    if (weekEntries.length <= 3) continue;
    if (existingSummaryTags.has(weekLabel)) continue;

    // Summarize this week's entries
    const entrySummaries = weekEntries.map((e, i) =>
      `${i + 1}. [${e.kind || "task"}] ${e.summary || "(no summary)"}${e.details ? " — " + e.details.slice(0, 100) : ""}`
    ).join("\n");

    // C-1: retry the Haiku invocation with exponential backoff on
    // transient errors (5xx, throttling, isengardcli credential blips).
    // On terminal failure: increment a degraded metric and skip this
    // week WITHOUT writing a placeholder. Pre-fix the catch logged once
    // and moved on; an entire weekly batch could silently fall behind
    // with no observable signal.
    const RETRY_DELAYS = [1000, 4000, 16000];
    let response = null;
    let lastErr = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        response = await haiku.invoke({
          system: "You consolidate memory entries into a concise weekly summary. Output a single paragraph (3-5 sentences) capturing the key themes, accomplishments, and patterns from the week. Be factual and specific.",
          messages: [{
            role: "user",
            content: [{ type: "text", text: `Summarize these ${weekEntries.length} memory entries from week ${weekLabel}:\n\n${entrySummaries}` }],
          }],
          max_tokens: 300,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || "");
        // Don't retry on hard credential failures — AuthProvider is genuinely
        // expired, not a transient blip.
        if (/AuthError|auth-init|InvalidIdentityToken|InvalidCli/i.test(msg)) break;
        if (attempt < RETRY_DELAYS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }
    if (lastErr || !response) {
      // Best-effort metric. The observability module is loaded at
      // server boot but memory-hooks may run from CLI / tests too;
      // fail silently if it isn't available.
      try {
        const obs = await import("./observability.js");
        obs.incCounter?.("ares_memory_summary_degraded_total");
      } catch {}
      console.error(`[memory-hooks] degraded — week ${weekLabel} skipped after retries: ${lastErr?.message || "no response"}`);
      continue;
    }

    const summaryText = response?.content?.find?.((c) => c.type === "text")?.text || "";
    if (!summaryText) continue;

    try {
      const recordResult = await hub.callTool("memory__memory_record", {
        summary: `Weekly summary ${weekLabel}: ${summaryText.slice(0, 150)}`,
        details: summaryText,
        kind: "fact",
        tags: ["weekly-summary", "consolidation", weekLabel],
        outcome: "completed",
      });
      // C-1 corollary (B-19): only count + log success when the record
      // actually persisted. Pre-fix summarizedCount bumped even on
      // result.isError.
      if (recordResult?.isError) {
        console.error(`[memory-hooks] memory_record returned error for week ${weekLabel}`);
        continue;
      }
      summarizedCount++;
      console.log(`[memory-hooks] summarized week ${weekLabel} (${weekEntries.length} entries)`);
    } catch (err) {
      console.error(`[memory-hooks] memory_record threw for week ${weekLabel}: ${err.message}`);
    }
  }

  console.log(`[memory-hooks] autoSummarize complete — ${summarizedCount} week(s) summarized`);
}

/**
 * Get ISO week label like "2025-W03" from a Date.
 */
function getISOWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
