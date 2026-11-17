import { z } from 'zod';
import { insightAnalysisSchema, type AnalyzeViewRequest, type InsightAnalysis } from '@fluid/shared';
import { bffClient, type LlmConfigOverrides } from '../../bff/client';

const errorBodySchema = z.object({ error: z.string(), details: z.unknown().optional() });
const responseSchema = z.object({ analysis: insightAnalysisSchema });

/** How long an analysis may take before the widget gives up: above the BFF's own limits (Claude Code 240 s). */
export const ANALYZE_TIMEOUT_MS = 300_000;

/** Asks the BFF to analyse what a view's widgets show; the answer is validated before use. */
export async function analyzeView(
  request: AnalyzeViewRequest,
  config: LlmConfigOverrides,
  signal?: AbortSignal,
): Promise<InsightAnalysis> {
  const timeout = AbortSignal.timeout(ANALYZE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${bffClient.base}/api/llm/analyze-view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...request, config }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (timeout.aborted) throw new Error(`The analysis took more than ${ANALYZE_TIMEOUT_MS / 1000}s`);
    throw err;
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new Error(error.success ? error.data.error : `The BFF answered ${res.status}`);
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new Error('The analysis received from the BFF is not valid');
  return parsed.data.analysis;
}
