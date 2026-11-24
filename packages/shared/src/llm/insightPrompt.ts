import { z } from 'zod';
import { insightAnalysisSchema, type AnalyzeViewRequest, type InsightAnalysis } from '..';
import { extractJson } from './json';
import type { ChatMessage } from './types';

// Prompt of the insight widget: an analyst reading the data the view's widgets
// show. The point is what the widgets do NOT already say: the model is told to
// compute, compare and cross widgets, and to answer "nothing" rather than
// paraphrase a chart.

const SYSTEM = `You are a sharp data analyst embedded in a dashboard. You receive the data that the
dashboard's widgets display (tables, charts, statistics…), as JSON. The user already SEES those widgets:
describing them is worthless. Your job is to find what they do not show at a glance.

Look for, and back with figures you compute from the data:
- anomalies and outliers (a value far from the others: say how far, e.g. "4.2× the median");
- concentrations and imbalances (Pareto: "3 of 20 items hold 71% of the total");
- relations between fields or ACROSS widgets (does A go with B? a segment that behaves differently?);
- gaps and data quality issues (missing, "unknown", duplicated, inconsistent values) that bias the reading;
- risks or opportunities a domain expert would flag;
- what is surprising given the domain (use your knowledge of it), and why.

Rules:
- Every finding is specific and quantified from the data given; never invent figures. Rows may be a
  sample: when "rowCount" exceeds the rows given, say the figure is on the sample.
- No finding that merely restates a title, a count shown by a statistic, or the largest slice of a chart.
- Prefer 2 to 5 strong findings over many weak ones; rank them, most important first.
- "severity": "critical" (needs action / breaks the reading), "notable" (worth knowing), "info" (context).
- "questions": up to 3 follow-up questions worth exploring next, concrete enough to become a new view.
- If the data holds nothing beyond what the widgets already show (too little data, nothing unusual),
  answer {"verdict": "nothing", "findings": []}. That is a perfectly good answer.
- Write in the language of the user's focus when one is given, else in English.

Answer with ONE JSON object and nothing else:
{
  "verdict": "insights" | "nothing",
  "headline"?: "<the one-sentence takeaway>",
  "findings": [
    { "kind": "anomaly"|"concentration"|"correlation"|"trend"|"gap"|"risk"|"opportunity"|"comparison",
      "severity": "info"|"notable"|"critical", "title": "<short claim>", "detail": "<why it matters, 1-3 sentences>",
      "evidence"?: ["<figure>", ...], "widgets"?: ["<widget id>", ...] }
  ],
  "questions"?: ["<follow-up question>", ...]
}`;

/** The user message: the view, the focus and every source's data. */
function describeRequest(request: AnalyzeViewRequest): string {
  const { view, focus, sources } = request;
  const header = [
    `Dashboard: "${view.title}" on the concept ${view.concept}.`,
    view.description ? `Description: ${view.description}` : null,
    focus ? `The user's focus: ${focus}` : 'No particular focus: find what matters most.',
  ].filter(Boolean);
  const blocks = sources.map((s) => {
    const label = [`Widget "${s.id}"`, `type ${s.type}`, s.title ? `title "${s.title}"` : null]
      .filter(Boolean)
      .join(', ');
    const count = s.rowCount !== undefined ? ` (${s.rowCount} rows in total)` : '';
    return `### ${label}${count}\n${JSON.stringify(s.data)}`;
  });
  return `${header.join('\n')}\n\n${blocks.join('\n\n')}`;
}

export function buildInsightMessages(request: AnalyzeViewRequest): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: describeRequest(request) },
  ];
}

/** Second chance after an answer that is not a valid analysis. */
export function buildInsightRepairMessage(errorText: string): ChatMessage {
  return {
    role: 'user',
    content: `Your answer is not a valid analysis object:\n${errorText}\nAnswer again with ONE JSON object only, following the format.`,
  };
}

export type ParsedInsight = { ok: true; analysis: InsightAnalysis } | { ok: false; errorText: string };

/** Reads a model answer as an analysis; the findings decide the verdict. */
export function parseInsight(answer: string): ParsedInsight {
  let json: unknown;
  try {
    json = extractJson(answer);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = insightAnalysisSchema.safeParse(json);
  if (!parsed.success) return { ok: false, errorText: z.prettifyError(parsed.error) };
  const analysis = parsed.data;
  return { ok: true, analysis: { ...analysis, verdict: analysis.findings.length > 0 ? 'insights' : 'nothing' } };
}
