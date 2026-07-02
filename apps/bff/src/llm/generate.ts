import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, safeParseViewSpecDraft, finalizeWidget, safeParseWidgetDraft, type ViewSpecDraft, type WidgetDraft } from '@fluid/shared';
import type { GenerateViewInput, GenerateViewResult, GenerateWidgetInput, GenerateWidgetResult } from './types';
import { resolveLlmConfig } from './config';
import { buildMessages, buildRepairMessage, buildWidgetMessages, buildWidgetRepairMessage } from './prompt';
import { chatCompletion, extractJson, extractReasoning } from './client';
import { mockDraft, mockWidgetDraft } from './mock';
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

function validateWidgetDraft(
  content: string,
): { ok: true; draft: WidgetDraft } | { ok: false; errorText: string } {
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = safeParseWidgetDraft(raw);
  if (parsed.success) return { ok: true, draft: parsed.data };
  const errorText = parsed.error.issues
    .slice(0, 8)
    .map((i: any) => `${i.path.join('.') || '(root)'}: ${i.message}`)
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

/**
 * Generate a single widget for a concept. Similar to generateView but targets
 * a single widget for modification/refinement. Can accept an existing widget
 * for context-aware modifications.
 */
export async function generateWidget(input: GenerateWidgetInput): Promise<GenerateWidgetResult> {
  const config = resolveLlmConfig(input.config);
  const widgetId = input.existingWidget?.id ?? `widget-${randomUUID().slice(0, 8)}`;

  if (config.provider === 'mock') {
    const draft = mockWidgetDraft(input);
    return {
      draft,
      widget: finalizeWidget(draft, widgetId),
      provider: config.provider,
      model: config.model,
      reasoning: undefined,
    };
  }

  const messages = buildWidgetMessages(input);
  let fullContent = await chatCompletion(config, messages);
  const { reasoning, content } = extractReasoning(fullContent);

  let result = validateWidgetDraft(content);

  if (!result.ok) {
    const repair = buildWidgetRepairMessage(result.errorText, content);
    fullContent = await chatCompletion(config, [
      ...messages,
      { role: 'assistant', content: fullContent },
      repair,
    ]);
    const { content: repairedContent } = extractReasoning(fullContent);
    const retry = validateWidgetDraft(repairedContent);
    if (!retry.ok) throw new LlmValidationError(retry.errorText, repairedContent);
    result = retry;
  }

  return {
    draft: result.draft,
    widget: finalizeWidget(result.draft, widgetId),
    provider: config.provider,
    model: config.model,
    reasoning: reasoning.length > 0 ? reasoning : undefined,
  };
}
