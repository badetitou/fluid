import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, safeParseViewSpecDraft, type ViewSpecDraft } from '@fluid/shared';
import type { GenerateViewInput, GenerateViewResult } from './types';
import { resolveLlmConfig } from './config';
import { buildMessages, buildRepairMessage } from './prompt';
import { chatCompletion, extractJson } from './client';
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
    };
  }

  const messages = buildMessages(input);
  let content = await chatCompletion(config, messages);
  let result = validateDraft(content);

  if (!result.ok) {
    const repair = buildRepairMessage(result.errorText, content);
    content = await chatCompletion(config, [
      ...messages,
      { role: 'assistant', content },
      repair,
    ]);
    const retry = validateDraft(content);
    if (!retry.ok) throw new LlmValidationError(retry.errorText, content);
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
  };
}
