import { parseInsight, type InsightAnalysis } from '@fluid/shared';
import { chatCompletion } from './client';
import { claudeCodeCompletion } from './claudeCode';
import { resolveLlmConfig } from './config';
import { LlmValidationError } from './errors';
import { buildInsightMessages, buildInsightRepairMessage } from './insightPrompt';
import { mockInsight } from './insightMock';
import type { AnalyzeViewInput, AnalyzeViewResult, ChatMessage, LlmConfig } from './types';

/** How long an OpenAI-compatible server may take per answer (Claude Code has its own limit). */
export const INSIGHT_TIMEOUT_MS = 120_000;

export { parseInsight } from '@fluid/shared';

const complete = (config: LlmConfig, messages: ChatMessage[]) =>
  config.provider === 'claude-code'
    ? claudeCodeCompletion(config, messages)
    : chatCompletion(config, messages, { timeoutMs: INSIGHT_TIMEOUT_MS });

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
