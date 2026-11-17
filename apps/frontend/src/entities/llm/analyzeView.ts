import { z } from 'zod';
import { insightAnalysisSchema, type AnalyzeViewRequest, type InsightAnalysis } from '@fluid/shared';
import { bffClient, type LlmConfigOverrides } from '../../bff/client';

const errorBodySchema = z.object({ error: z.string(), details: z.unknown().optional() });
const responseSchema = z.object({ analysis: insightAnalysisSchema });

/** Asks the BFF to analyse what a view's widgets show; the answer is validated before use. */
export async function analyzeView(
  request: AnalyzeViewRequest,
  config: LlmConfigOverrides,
  signal?: AbortSignal,
): Promise<InsightAnalysis> {
  const res = await fetch(`${bffClient.base}/api/llm/analyze-view`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...request, config }),
    signal,
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new Error(error.success ? error.data.error : `The BFF answered ${res.status}`);
  }
  return responseSchema.parse(body).analysis;
}
