import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, finalizeWidget, resolveWidgetCatalog } from '@fluid/shared';
import type { GenerateViewInput, GenerateViewResult, GenerateWidgetInput, GenerateWidgetResult, LlmDeltaHandler } from './types';
import { resolveLlmConfig } from './config';
import { buildMessages, buildRepairMessage, buildWidgetMessages, buildWidgetRepairMessage } from './prompt';
import { chatCompletion, extractReasoning } from './client';
import { generateViewWithClaude, generateWidgetWithClaude } from './claudeGenerate';
import { mockDraft, mockWidgetDraft } from './mock';
import { LlmValidationError } from './errors';
import { validateDraft, validateWidgetDraft } from './validateDraft';

/**
 * Generate a view for a concept. The `mock` provider returns a deterministic
 * draft; real providers call the LLM, validate the JSON, and get one repair
 * attempt before failing. The validated draft is finalized into a full ViewSpec.
 * Also extracts and returns reasoning steps if the LLM provides them.
 * `onDelta` receives streamed output when the provider supports it (Claude Code).
 */
export async function generateView(
  input: GenerateViewInput,
  onDelta?: LlmDeltaHandler,
): Promise<GenerateViewResult> {
  const config = resolveLlmConfig(input.config);

  if (config.provider === 'mock') {
    const draft = mockDraft(input);
    return {
      draft,
      spec: finalizeViewSpec(
        { ...draft, scope: input.scope },
        { concept: input.concept, id: `gen-${randomUUID().slice(0, 8)}` },
      ),
      provider: config.provider,
      model: config.model,
      reasoning: undefined,
    };
  }

  if (config.provider === 'claude-code') {
    return generateViewWithClaude(input, config, onDelta);
  }

  const catalog = resolveWidgetCatalog(input.widgets);
  const messages = buildMessages(input);
  let fullContent = await chatCompletion(config, messages);
  const { reasoning, content } = extractReasoning(fullContent);

  let result = validateDraft(content, catalog);

  if (!result.ok) {
    const repair = buildRepairMessage(result.errorText, content);
    fullContent = await chatCompletion(config, [
      ...messages,
      { role: 'assistant', content: fullContent },
      repair,
    ]);
    const { content: repairedContent } = extractReasoning(fullContent);
    const retry = validateDraft(repairedContent, catalog);
    if (!retry.ok) throw new LlmValidationError(retry.errorText, repairedContent);
    result = retry;
  }

  return {
    draft: result.draft,
    spec: finalizeViewSpec({ ...result.draft, scope: result.draft.scope ?? input.scope }, {
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

  if (config.provider === 'claude-code') {
    return generateWidgetWithClaude(input, config, widgetId);
  }

  const catalog = resolveWidgetCatalog(input.widgets);
  const viewIds = (input.viewWidgets ?? []).map((w) => w.id);
  const messages = buildWidgetMessages(input);
  let fullContent = await chatCompletion(config, messages);
  const { reasoning, content } = extractReasoning(fullContent);

  let result = validateWidgetDraft(content, catalog, viewIds);

  if (!result.ok) {
    const repair = buildWidgetRepairMessage(result.errorText, content);
    fullContent = await chatCompletion(config, [
      ...messages,
      { role: 'assistant', content: fullContent },
      repair,
    ]);
    const { content: repairedContent } = extractReasoning(fullContent);
    const retry = validateWidgetDraft(repairedContent, catalog, viewIds);
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
