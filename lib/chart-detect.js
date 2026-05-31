// Phase Q-pass-5 P0-3 — chart_block detection.
//
// Inspects a tool_result's text and decides whether it carries a
// chart-shaped JSON payload. When yes, returns a sanitised chart
// descriptor for the SSE `chart_block` event; the UI renders it via
// Chart.js inline.
//
// Three accepted shapes (any one fires):
//   A) JSON object whose top-level `type === "chart"` and
//      `chartType` ∈ {line, bar, doughnut}.  Matches §4.4.
//   B) JSON object whose top-level `type === "kpi-cards"` with an
//      `items: [{label,value,color?,kind?}]` array.
//   C) JSON object whose top-level `type === "vendor-table"` with
//      a `rows: [{vendor, status, action}]` array (rendered as the
//      coloured-emoji table from §13.1).
//
// Detection is intentionally PERMISSIVE — the model rarely emits
// pure JSON; usually it's wrapped in a fenced code block or text
// preamble. We extract the first JSON object that parses, validate
// its shape, and ignore everything else.
//
// Hardening:
//   - Caps input scan at 64KB so a runaway tool result doesn't burn
//     CPU. Anything past the cap is ignored.
//   - All field types are sanity-checked. Bad shapes return null —
//     the agent yields the regular tool_result and the UI never sees
//     a chart_block.
//   - Strips any inline scripts / event handlers from string fields
//     before yielding (defense-in-depth — the UI already sanitises
//     via DOMPurify, but stripping early keeps the SSE log clean).

const SCAN_CAP = 64 * 1024;
const ALLOWED_CHART_TYPES = new Set(["line", "bar", "doughnut"]);
const ALLOWED_STATUSES = new Set(["green", "yellow", "red", "info", "neutral"]);

function _stripUnsafe(s) {
  if (typeof s !== "string") return "";
  return s.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
          .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
          .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
          .slice(0, 4000);
}

function _findFirstJsonObject(text) {
  if (!text || typeof text !== "string") return null;
  const slice = text.slice(0, SCAN_CAP);
  // Try direct parse first (text is already pure JSON).
  const direct = slice.trim();
  if (direct.startsWith("{") && direct.endsWith("}")) {
    try { return JSON.parse(direct); } catch {}
  }
  // Fenced ```json blocks first (most common LLM shape).
  const fenceRe = /```(?:json)?\s*\n([\s\S]*?)```/gi;
  let m;
  while ((m = fenceRe.exec(slice)) !== null) {
    const candidate = m[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      try { return JSON.parse(candidate); } catch {}
    }
  }
  // Bare JSON braces — find the largest balanced { … }.
  const start = slice.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < slice.length; i++) {
    const c = slice[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = slice.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch {}
        return null;
      }
    }
  }
  return null;
}

function _validateChart(j) {
  if (!ALLOWED_CHART_TYPES.has(j.chartType)) return null;
  const data = j.data;
  if (!data || typeof data !== "object") return null;
  const labels = Array.isArray(data.labels) ? data.labels.map(_stripUnsafe).slice(0, 200) : [];
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];
  const cleanDatasets = [];
  for (const ds of datasets.slice(0, 6)) {
    if (!ds || !Array.isArray(ds.data)) continue;
    cleanDatasets.push({
      label: _stripUnsafe(ds.label || ""),
      data: ds.data.slice(0, 200).map((v) => (typeof v === "number" && Number.isFinite(v)) ? v : 0),
      backgroundColor: typeof ds.backgroundColor === "string" ? _stripUnsafe(ds.backgroundColor) : undefined,
      borderColor: typeof ds.borderColor === "string" ? _stripUnsafe(ds.borderColor) : undefined,
    });
  }
  if (!cleanDatasets.length) return null;
  return {
    chartType: j.chartType,
    title: _stripUnsafe(j.title || ""),
    data: { labels, datasets: cleanDatasets },
    options: {
      indexAxis: j.options?.indexAxis === "y" ? "y" : "x",
      stacked: !!j.options?.stacked,
    },
  };
}

function _validateKpiCards(j) {
  const items = Array.isArray(j.items) ? j.items : [];
  if (!items.length) return null;
  const cleanItems = [];
  for (const it of items.slice(0, 8)) {
    if (!it || typeof it !== "object") continue;
    const kind = ALLOWED_STATUSES.has(it.kind) ? it.kind : "neutral";
    cleanItems.push({
      label: _stripUnsafe(it.label || ""),
      value: typeof it.value === "number" || typeof it.value === "string"
        ? _stripUnsafe(String(it.value))
        : "",
      kind,
    });
  }
  if (!cleanItems.length) return null;
  return {
    chartType: "kpi-cards",
    title: _stripUnsafe(j.title || ""),
    items: cleanItems,
  };
}

function _validateVendorTable(j) {
  const rows = Array.isArray(j.rows) ? j.rows : [];
  if (!rows.length) return null;
  const cleanRows = [];
  for (const r of rows.slice(0, 50)) {
    if (!r || typeof r !== "object") continue;
    const status = ALLOWED_STATUSES.has(r.status) ? r.status : "neutral";
    cleanRows.push({
      vendor: _stripUnsafe(r.vendor || ""),
      status,
      statusText: _stripUnsafe(r.statusText || ""),
      action: _stripUnsafe(r.action || ""),
    });
  }
  if (!cleanRows.length) return null;
  return {
    chartType: "vendor-table",
    title: _stripUnsafe(j.title || ""),
    rows: cleanRows,
  };
}

/**
 * Detect a chart-shaped tool result. Returns a chart_block descriptor
 * or null. Never throws.
 */
export function detectChartBlock(text) {
  try {
    const j = _findFirstJsonObject(text);
    if (!j || j.type !== "chart" && j.type !== "kpi-cards" && j.type !== "vendor-table") return null;
    if (j.type === "chart") return _validateChart(j);
    if (j.type === "kpi-cards") return _validateKpiCards(j);
    if (j.type === "vendor-table") return _validateVendorTable(j);
    return null;
  } catch {
    return null;
  }
}

export const _internals = {
  _findFirstJsonObject,
  _validateChart,
  _validateKpiCards,
  _validateVendorTable,
  _stripUnsafe,
};
