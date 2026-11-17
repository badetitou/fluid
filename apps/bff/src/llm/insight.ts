import { z } from 'zod';
import { insightAnalysisSchema, type AnalyzeViewRequest, type InsightAnalysis } from '@fluid/shared';
import { chatCompletion, extractJson } from './client';
import { claudeCodeCompletion } from './claudeCode';
import { resolveLlmConfig } from './config';
import { LlmValidationError } from './errors';
import { buildInsightMessages, buildInsightRepairMessage } from './insightPrompt';
import { mockInsight } from './insightMock';
import type { ChatMessage, LlmConfig, LlmConfigOverrides, LlmProvider } from './types';

export interface AnalyzeViewInput extends AnalyzeViewRequest {
  config?: LlmConfigOverrides;
}

export interface AnalyzeViewResult {
  analysis: InsightAnalysis;
  provider: LlmProvider;
  model: string;
}

type Parsed = { ok: true; analysis: InsightAnalysis } | { ok: false; errorText: string };

/** Reads the model's answer as an analysis: a JSON object, checked against the shared schema. */
export function parseInsight(answer: string): Parsed {
  let json: unknown;
  try {
    json = extractJson(answer);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = insightAnalysisSchema.safeParse(json);
  if (!parsed.success) return { ok: false, errorText: z.prettifyError(parsed.error) };
  const analysis = parsed.data;
  // "insights" without a finding has nothing to show: it is a "nothing".
  return { ok: true, analysis: analysis.findings.length === 0 ? { ...analysis, verdict: 'nothing' } : analysis };
}

const complete = (config: LlmConfig, messages: ChatMessage[]) =>
  config.provider === 'claude-code' ? claudeCodeCompletion(config, messages) : chatCompletion(config, messages);

/**
 * Analyses what a view's widgets show. The mock provider answers from simple
 * heuristics; real providers get one repair turn when the answer is not valid.
 */
export async function analyzeView(input: AnalyzeViewInput): Promise<AnalyzeViewResult> {
  const config = resolveLlmConfig(input.config);
  const done = (analysis: InsightAnalysis) => ({ analysis, provider: config.provider, model: config.model });
  if (config.provider === 'mock') return done(mockInsight(input));

  const messages = buildInsightMessages(input);
  const answer = await complete(config, messages);
  const first = parseInsight(answer);
  if (first.ok) return done(first.analysis);

  const repaired = await complete(config, [
    ...messages,
    { role: 'assistant', content: answer },
    buildInsightRepairMessage(first.errorText),
  ]);
  const retry = parseInsight(repaired);
  if (!retry.ok) throw new LlmValidationError(retry.errorText, repaired);
  return done(retry.analysis);
}
