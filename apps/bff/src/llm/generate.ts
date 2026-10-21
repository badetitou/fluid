import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, safeParseViewSpecDraft, finalizeWidget, safeParseWidgetDraft, type ViewSpecDraft, type WidgetDraft } from '@fluid/shared';
import type {
  ChatMessage,
  GenerateViewInput,
  GenerateViewResult,
  GenerateWidgetInput,
  GenerateWidgetResult,
  LlmConfig,
  LlmDeltaHandler,
} from './types';
import { resolveLlmConfig } from './config';
import { buildMessages, buildRepairMessage, buildWidgetMessages, buildWidgetRepairMessage } from './prompt';
import { buildClaudeMessages, buildClaudeRepairMessage, parseClaudeAnswer } from './claudePrompt';
import { chatCompletion, extractJson, extractReasoning } from './client';
import { claudeCodeCompletion } from './claudeCode';
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

/** Send a chat to the configured (non-mock) provider. */
function complete(
  config: LlmConfig,
  messages: ChatMessage[],
  onDelta?: LlmDeltaHandler,
): Promise<string> {
  return config.provider === 'claude-code'
    ? claudeCodeCompletion(config, messages, onDelta)
    : chatCompletion(config, messages);
}

/**
 * Claude Code variant of view generation: a Claude-tuned prompt answered with
 * <reasoning>/<view> sections, streamed through `onDelta`, with one repair turn.
 */
async function generateViewWithClaude(
  input: GenerateViewInput,
  config: LlmConfig,
  onDelta?: LlmDeltaHandler,
): Promise<GenerateViewResult> {
  const messages = buildClaudeMessages(input);
  const answer = await complete(config, messages, onDelta);
  const { reasoning, content } = parseClaudeAnswer(answer);

  let result = validateDraft(content);
  if (!result.ok) {
    onDelta?.({ kind: 'text', text: '\n\n[Fixing validation errors…]\n\n' });
    const repaired = await complete(
      config,
      [...messages, { role: 'assistant', content: answer }, buildClaudeRepairMessage(result.errorText)],
      onDelta,
    );
    const retry = validateDraft(parseClaudeAnswer(repaired).content);
    if (!retry.ok) throw new LlmValidationError(retry.errorText, repaired);
    result = retry;
  }

  return {
    draft: result.draft,
    spec: finalizeViewSpec(
      { ...result.draft, scope: result.draft.scope ?? input.scope },
      { concept: input.concept, id: `gen-${randomUUID().slice(0, 8)}` },
    ),
    provider: config.provider,
    model: config.model,
    reasoning: reasoning.length > 0 ? reasoning : undefined,
  };
}

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

  const messages = buildWidgetMessages(input);
  let fullContent = await complete(config, messages);
  const { reasoning, content } = extractReasoning(fullContent);

  let result = validateWidgetDraft(content);

  if (!result.ok) {
    const repair = buildWidgetRepairMessage(result.errorText, content);
    fullContent = await complete(config, [
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
