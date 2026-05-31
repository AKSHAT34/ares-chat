// Tiny 5-field cron parser sufficient for the jobs we run.
// Fields: minute hour day-of-month month day-of-week
// Each field supports: *, N, N-M, */K, A,B,C, and combinations like 1-5,15.
// Day-of-week 0 and 7 both mean Sunday.
// Local time only.

export function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`bad cron: ${expr}`);
  const ranges = [
    parseField(parts[0], 0, 59),
    parseField(parts[1], 0, 23),
    parseField(parts[2], 1, 31),
    parseField(parts[3], 1, 12),
    parseField(parts[4], 0, 7).map((d) => (d === 7 ? 0 : d)),
  ];
  const sets = ranges.map((arr) => new Set(arr));
  return {
    expr,
    matches(date) {
      return (
        sets[0].has(date.getMinutes()) &&
        sets[1].has(date.getHours()) &&
        sets[2].has(date.getDate()) &&
        sets[3].has(date.getMonth() + 1) &&
        sets[4].has(date.getDay())
      );
    },
    nextAfter(date) {
      const d = new Date(date.getTime() + 60 * 1000);
      d.setSeconds(0, 0);
      for (let i = 0; i < 60 * 24 * 366; i++) {
        if (this.matches(d)) return d;
        d.setMinutes(d.getMinutes() + 1);
      }
      return null;
    },
  };
}

function parseField(field, lo, hi) {
  const out = new Set();
  for (const part of field.split(",")) {
    let step = 1;
    let body = part;
    const slash = part.indexOf("/");
    if (slash >= 0) {
      step = parseInt(part.slice(slash + 1), 10) || 1;
      body = part.slice(0, slash);
    }
    let start, end;
    if (body === "*") {
      start = lo; end = hi;
    } else if (body.includes("-")) {
      const [a, b] = body.split("-").map((n) => parseInt(n, 10));
      start = a; end = b;
    } else {
      const v = parseInt(body, 10);
      start = v; end = v;
    }
    if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`bad cron field: ${field}`);
    for (let v = start; v <= end; v += step) {
      if (v >= lo && v <= hi) out.add(v);
    }
  }
  return [...out].sort((a, b) => a - b);
}
