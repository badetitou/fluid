import { NOTHING_TO_ADD, type AnalyzeViewRequest, type InsightAnalysis, type InsightFinding } from '@fluid/shared';

// Offline analysis for the `mock` provider: a couple of deterministic heuristics
// (one value dominating a field, a field mostly missing), so the widget can be
// tried without a model. Anything subtler is the real model's job.

const MIN_ROWS = 5;
const DOMINANT_SHARE = 0.5;
const MISSING_SHARE = 0.2;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMissing = (v: unknown) => v === null || v === undefined || v === '' || (typeof v === 'string' && /^unknown$/i.test(v));
const percent = (n: number, total: number) => `${Math.round((100 * n) / total)}%`;

/** Findings about the text fields of one widget's rows. */
function fieldFindings(widgetId: string, rows: Record<string, unknown>[]): InsightFinding[] {
  const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const findings: InsightFinding[] = [];
  for (const field of fields) {
    const values = rows.map((r) => r[field]);
    if (values.some((v) => typeof v !== 'string' && !isMissing(v))) continue;
    const missing = values.filter(isMissing).length;
    if (missing / rows.length >= MISSING_SHARE) {
      findings.push({
        kind: 'gap',
        severity: 'notable',
        title: `"${field}" is missing for ${percent(missing, rows.length)} of the rows`,
        detail: 'Figures grouped by this field leave a large share of the data out, or lump it under "unknown".',
        evidence: [`${missing} of ${rows.length} rows`],
        widgets: [widgetId],
      });
      continue;
    }
    const counts = new Map<string, number>();
    for (const v of values) if (typeof v === 'string') counts.set(v, (counts.get(v) ?? 0) + 1);
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    if (counts.size >= 2 && counts.size < rows.length && n / rows.length >= DOMINANT_SHARE) {
      findings.push({
        kind: 'concentration',
        severity: 'info',
        title: `"${top}" dominates "${field}" (${percent(n, rows.length)})`,
        detail: `The ${counts.size - 1} other values share what is left: comparisons between them rest on few rows.`,
        evidence: [`${n} of ${rows.length} rows`],
        widgets: [widgetId],
      });
    }
  }
  return findings;
}

export function mockInsight(request: AnalyzeViewRequest): InsightAnalysis {
  const findings = request.sources.flatMap((source) => {
    const rows = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
    return rows.length >= MIN_ROWS ? fieldFindings(source.id, rows) : [];
  });
  if (findings.length === 0) return NOTHING_TO_ADD;
  return {
    verdict: 'insights',
    headline: 'A first look by the offline analyst (mock provider): pick a real model for an in-depth analysis.',
    findings: findings.slice(0, 5),
  };
}
