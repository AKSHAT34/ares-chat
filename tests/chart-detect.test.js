// Phase Q-pass-5 P0-3 — chart_block detection tests.
import { describe, it, expect } from "vitest";
import { detectChartBlock } from "../lib/chart-detect.js";

describe("chart-detect", () => {
  it("detects a bar chart in a fenced json block", () => {
    const text = '```json\n{"type":"chart","chartType":"bar","title":"ProjectX Hit Rate","data":{"labels":["VENDOR1","VENDOR4"],"datasets":[{"label":"Hit","data":[5,3]}]}}\n```';
    const r = detectChartBlock(text);
    expect(r).toBeTruthy();
    expect(r.chartType).toBe("bar");
    expect(r.title).toBe("ProjectX Hit Rate");
    expect(r.data.datasets[0].data).toEqual([5, 3]);
  });

  it("detects raw JSON without fence", () => {
    const text = '{"type":"chart","chartType":"line","data":{"labels":["a"],"datasets":[{"data":[1,2,3]}]}}';
    const r = detectChartBlock(text);
    expect(r?.chartType).toBe("line");
  });

  it("detects KPI cards", () => {
    const text = '{"type":"kpi-cards","title":"Portfolio","items":[{"label":"TOTAL","value":35,"kind":"info"},{"label":"HIT RATE","value":"63%","kind":"yellow"}]}';
    const r = detectChartBlock(text);
    expect(r?.chartType).toBe("kpi-cards");
    expect(r.items.length).toBe(2);
    expect(r.items[1].kind).toBe("yellow");
  });

  it("detects vendor table", () => {
    const text = '{"type":"vendor-table","rows":[{"vendor":"VENDOR1","status":"green","statusText":"5/5","action":"maintain"}]}';
    const r = detectChartBlock(text);
    expect(r?.chartType).toBe("vendor-table");
    expect(r.rows[0].vendor).toBe("VENDOR1");
  });

  it("returns null for plain tool output", () => {
    expect(detectChartBlock("Just a string with no JSON")).toBeNull();
    expect(detectChartBlock('{"foo":"bar"}')).toBeNull();
    expect(detectChartBlock("")).toBeNull();
    expect(detectChartBlock(null)).toBeNull();
  });

  it("rejects unknown chartType", () => {
    const text = '{"type":"chart","chartType":"radar","data":{"labels":[],"datasets":[{"data":[]}]}}';
    expect(detectChartBlock(text)).toBeNull();
  });

  it("strips inline scripts from string fields", () => {
    const text = '{"type":"chart","chartType":"bar","title":"<script>alert(1)</script>Hi","data":{"labels":["a<script>x</script>"],"datasets":[{"label":"d","data":[1]}]}}';
    const r = detectChartBlock(text);
    expect(r.title).not.toContain("<script>");
    expect(r.title).toContain("Hi");
    expect(r.data.labels[0]).not.toContain("<script>");
  });

  it("caps oversized inputs", () => {
    const big = "x".repeat(80 * 1024);
    const text = big + '{"type":"chart","chartType":"bar","data":{"labels":[],"datasets":[{"data":[]}]}}';
    expect(detectChartBlock(text)).toBeNull();
  });

  it("normalises non-finite numeric values to 0", () => {
    const text = JSON.stringify({
      type: "chart", chartType: "bar",
      data: { labels: ["a", "b", "c"], datasets: [{ label: "x", data: [1, "bad", null] }] },
    });
    const r = detectChartBlock(text);
    expect(r?.data.datasets[0].data).toEqual([1, 0, 0]);
  });
});
