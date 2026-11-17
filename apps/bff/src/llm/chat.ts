import { randomUUID } from 'node:crypto';
import { finalizeViewSpec, resolveWidgetCatalog, type ViewSpecDraft } from '@fluid/shared';
import type { ChatMessage, LlmConfig } from './types';
import type { ChatInput, ChatResult } from './chatTypes';
import { resolveLlmConfig } from './config';
import { chatCompletion, extractReasoning } from './client';
import { claudeCodeCompletion } from './claudeCode';
import { parseClaudeAnswer } from './claudePrompt';
import { buildChatMessages, buildChatRepairMessage, type ChatFormat } from './chatPrompt';
import { DROPPED_VIEW_NOTE, validateChatAnswer, type ChatAnswerOk } from './chatAnswer';
import { mockChatDraft } from './chatMock';
import { LlmValidationError } from './errors';

type Meta = Pick<ChatResult, 'provider' | 'model'>;

function finalize(input: ChatInput, draft: ViewSpecDraft) {
  return finalizeViewSpec(draft, { concept: input.concept, id: `chat-${randomUUID().slice(0, 8)}` });
}

/** One model turn: the raw text, and the JSON content inside it. */
async function turn(config: LlmConfig, format: ChatFormat, messages: ChatMessage[]) {
  if (format === 'claude') {
    const raw = await claudeCodeCompletion(config, messages);
    return { raw, content: parseClaudeAnswer(raw, 'chat').content };
  }
  const raw = await chatCompletion(config, messages);
  return { raw, content: extractReasoning(raw).content };
}

function toResult(input: ChatInput, answer: ChatAnswerOk, meta: Meta): ChatResult {
  return {
    message: answer.message,
    view: answer.draft && finalize(input, answer.draft),
    suggestView: answer.suggestView,
    ...meta,
  };
}

/**
 * Answer a chat message. The `mock` provider is deterministic; real providers
 * get one repair turn. A broken view is dropped (the text is kept, with a
 * note); an answer that is not valid JSON at all fails with LlmValidationError.
 */
export async function chat(input: ChatInput): Promise<ChatResult> {
  const config = resolveLlmConfig(input.config);
  const meta: Meta = { provider: config.provider, model: config.model };

  if (config.provider === 'mock') {
    const { message, draft } = mockChatDraft(input);
    return { message, view: draft && finalize(input, draft), suggestView: Boolean(draft), ...meta };
  }

  const catalog = resolveWidgetCatalog(input.widgets);
  const format: ChatFormat = config.provider === 'claude-code' ? 'claude' : 'json';
  const messages = buildChatMessages(input, format);
  const check = (content: string) => validateChatAnswer(content, catalog, input.schema.mutationFields);

  const first = await turn(config, format, messages);
  const firstCheck = check(first.content);
  if (firstCheck.ok) return toResult(input, firstCheck, meta);

  const repair = buildChatRepairMessage(firstCheck.errorText, format);
  const second = await turn(config, format, [...messages, { role: 'assistant', content: first.raw }, repair]);
  const retry = check(second.content);
  if (retry.ok) {
    const answer = toResult(input, retry, meta);
    // The first view was broken and the repair came back without one: say so.
    if (!answer.view && firstCheck.message) answer.message = `${answer.message}\n\n${DROPPED_VIEW_NOTE}`;
    return answer;
  }

  // Text fine but view broken twice: keep the text, drop the view.
  const kept = retry.message ?? firstCheck.message;
  if (kept) {
    return {
      message: `${kept}\n\n${DROPPED_VIEW_NOTE}`,
      suggestView: retry.suggestView ?? firstCheck.suggestView,
      ...meta,
    };
  }
  throw new LlmValidationError(retry.errorText, second.content, 'LLM produced an invalid chat answer');
}
