import { z } from 'zod';

// What the insight widget sends to the BFF (the data its sources show) and what
// the LLM answers (validated before it reaches the widget).

/** Most widgets one analysis reads. */
export const INSIGHT_MAX_SOURCES = 20;
/** Upper bound on the JSON of the analysed data, checked by the BFF (the frontend aims well below). */
export const INSIGHT_MAX_REQUEST_CHARS = 200_000;

/** One widget whose data is analysed, its data already compacted by the frontend. */
export const insightSourceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  /** Number of rows the widget shows, when its data is a list (the sample may hold fewer). */
  rowCount: z.number().int().nonnegative().optional(),
  data: z.unknown(),
});
export type InsightSource = z.infer<typeof insightSourceSchema>;

export const analyzeViewRequestSchema = z.object({
  view: z.object({
    title: z.string(),
    concept: z.string(),
    description: z.string().optional(),
  }),
  focus: z.string().max(500).optional(),
  sources: z.array(insightSourceSchema).max(INSIGHT_MAX_SOURCES),
});
export type AnalyzeViewRequest = z.infer<typeof analyzeViewRequestSchema>;

export const insightSeveritySchema = z.enum(['info', 'notable', 'critical']);
export type InsightSeverity = z.infer<typeof insightSeveritySchema>;

/** One thing the analysis found, backed by figures from the data. */
export const insightFindingSchema = z.object({
  /** What sort of finding: anomaly, concentration, correlation, trend, gap, risk… */
  kind: z.string().min(1).max(40),
  severity: insightSeveritySchema.catch('info'),
  title: z.string().min(1).max(200),
  /** Why it matters, in a few sentences. */
  detail: z.string().min(1).max(1500),
  /** The figures behind it (e.g. "7 of 20 rows", "median 12, max 480"). */
  evidence: z.array(z.string().min(1).max(300)).max(6).optional(),
  /** Ids of the widgets the finding comes from. */
  widgets: z.array(z.string()).max(20).optional(),
});
export type InsightFinding = z.infer<typeof insightFindingSchema>;

/**
 * The analysis: findings beyond what the widgets already show, or `nothing`
 * when the data holds no story worth telling.
 */
export const insightAnalysisSchema = z.object({
  verdict: z.enum(['insights', 'nothing']),
  /** The one-sentence takeaway. */
  headline: z.string().max(300).optional(),
  findings: z.array(insightFindingSchema).max(8).default([]),
  /** Questions worth asking next, to dig further. */
  questions: z.array(z.string().min(1).max(300)).max(5).optional(),
});
export type InsightAnalysis = z.infer<typeof insightAnalysisSchema>;

/** An analysis that says there is nothing more to tell. */
export const NOTHING_TO_ADD: InsightAnalysis = { verdict: 'nothing', findings: [] };
