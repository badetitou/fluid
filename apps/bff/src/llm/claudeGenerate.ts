import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, finalizeWidget, resolveWidgetCatalog } from '@fluid/shared';
import type {
  GenerateViewInput,
  GenerateViewResult,
  GenerateWidgetInput,
  GenerateWidgetResult,
  LlmConfig,
  LlmDeltaHandler,
} from './types';
import { buildClaudeMessages, buildClaudeRepairMessage, parseClaudeAnswer } from './claudePrompt';
import { buildClaudeWidgetMessages, buildClaudeWidgetRepairMessage } from './claudeWidgetPrompt';
import { claudeCodeCompletion } from './claudeCode';
import { LlmValidationError } from './errors';
import { validateDraft, validateWidgetDraft } from './validateDraft';

// The `claude-code` provider gets its own prompts (see claudePrompt.ts and
// claudeWidgetPrompt.ts), answered with <reasoning> plus a tagged JSON section.

/**
 * Claude Code variant of view generation: a Claude-tuned prompt answered with
 * <reasoning>/<view> sections, streamed through `onDelta`, with one repair turn.
 */
export async function generateViewWithClaude(
  input: GenerateViewInput,
  config: LlmConfig,
  onDelta?: LlmDeltaHandler,
): Promise<GenerateViewResult> {
  const catalog = resolveWidgetCatalog(input.widgets);
  const messages = buildClaudeMessages(input);
  const answer = await claudeCodeCompletion(config, messages, onDelta);
  const { reasoning, content } = parseClaudeAnswer(answer);

  let result = validateDraft(content, catalog, input.schema.mutationFields);
  if (!result.ok) {
    onDelta?.({ kind: 'text', text: '\n\n[Fixing validation errors…]\n\n' });
    const repaired = await claudeCodeCompletion(
      config,
      [...messages, { role: 'assistant', content: answer }, buildClaudeRepairMessage(result.errorText)],
      onDelta,
    );
    const retry = validateDraft(parseClaudeAnswer(repaired).content, catalog, input.schema.mutationFields);
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
 * Claude Code variant of widget generation: a Claude-tuned prompt answered with
 * <reasoning>/<widget> sections, with one repair turn.
 */
export async function generateWidgetWithClaude(
  input: GenerateWidgetInput,
  config: LlmConfig,
  widgetId: string,
): Promise<GenerateWidgetResult> {
  const catalog = resolveWidgetCatalog(input.widgets);
  const viewIds = (input.viewWidgets ?? []).map((w) => w.id);
  const viewActions = Object.keys(input.viewActions ?? {});
  const messages = buildClaudeWidgetMessages(input);
  const answer = await claudeCodeCompletion(config, messages);
  const { reasoning, content } = parseClaudeAnswer(answer, 'widget');

  let result = validateWidgetDraft(content, catalog, viewIds, viewActions);
  if (!result.ok) {
    const repaired = await claudeCodeCompletion(config, [
      ...messages,
      { role: 'assistant', content: answer },
      buildClaudeWidgetRepairMessage(result.errorText),
    ]);
    const retry = validateWidgetDraft(parseClaudeAnswer(repaired, 'widget').content, catalog, viewIds, viewActions);
    if (!retry.ok) throw new LlmValidationError(retry.errorText, repaired);
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
