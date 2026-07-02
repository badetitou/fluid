import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, safeParseViewSpecDraft, type ViewSpecDraft } from '@fluid/shared';
import type { GenerateViewInput, GenerateViewResult } from './types';
import { resolveLlmConfig } from './config';
import { buildMessages, buildRepairMessage } from './prompt';
import { chatCompletion, extractJson, extractReasoning } from './client';
import { mockDraft } from './mock';
import { LlmValidationError } from './errors';

function validateDraft(
  content: string,
): { ok: true; draft: ViewSpecDraft } | { ok: false; errorText: string } {
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = safeParseViewSpecDraft(raw);
  if (parsed.success) return { ok: true, draft: parsed.data };
  const errorText = parsed.error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return { ok: false, errorText };
}

/**
 * Generate a view for a concept. The `mock` provider returns a deterministic
 * draft; real providers call the LLM, validate the JSON, and get one repair
 * attempt before failing. The validated draft is finalized into a full ViewSpec.
 * Also extracts and returns reasoning steps if the LLM provides them.
 */
export async function generateView(input: GenerateViewInput): Promise<GenerateViewResult> {
  const config = resolveLlmConfig(input.config);

  if (config.provider === 'mock') {
    const draft = mockDraft(input);
    return {
      draft,
      spec: finalizeViewSpec(draft, { concept: input.concept, id: `gen-${randomUUID().slice(0, 8)}` }),
      provider: config.provider,
      model: config.model,
      reasoning: undefined,
    };
  }

  const messages = buildMessages(input);
  let fullContent = await chatCompletion(config, messages);
  const { reasoning, content } = extractReasoning(fullContent);

  let result = validateDraft(content);

  if (!result.ok) {
    const repair = buildRepairMessage(result.errorText, content);
    fullContent = await chatCompletion(config, [
      ...messages,
      { role: 'assistant', content: fullContent },
      repair,
    ]);
    const { content: repairedContent } = extractReasoning(fullContent);
    const retry = validateDraft(repairedContent);
    if (!retry.ok) throw new LlmValidationError(retry.errorText, repairedContent);
    result = retry;
  }

  return {
    draft: result.draft,
    spec: finalizeViewSpec(result.draft, {
      concept: input.concept,
      id: `gen-${randomUUID().slice(0, 8)}`,
    }),
    provider: config.provider,
    model: config.model,
    reasoning: reasoning.length > 0 ? reasoning : undefined,
  };
}
