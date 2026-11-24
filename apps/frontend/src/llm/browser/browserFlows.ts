import {
  buildChatMessages,
  buildChatRepairMessage,
  buildInsightMessages,
  buildInsightRepairMessage,
  buildMessages,
  buildRepairMessage,
  buildWidgetMessages,
  buildWidgetRepairMessage,
  DROPPED_VIEW_NOTE,
  extractReasoning,
  finalizeViewSpec,
  finalizeWidget,
  parseInsight,
  resolveWidgetCatalog,
  validateChatAnswer,
  validateDraft,
  validateWidgetDraft,
  type ChatMessage,
  type InsightAnalysis,
  type ViewSpecDraft,
} from '@fluid/shared';
import type { AnalyzeViewRequest, ChatInput, ChatResponse, WidgetCatalogRequest } from '@fluid/shared';
import type { GenerateViewPayload, GenerateWidgetPayload, LlmDelta } from '../../bff/client';
import { browserComplete } from './browserEngine';

// Same prompts, validation and single repair turn as the BFF, but the model
// runs in the tab. Nothing here imports a transport or sends settings away.

const newId = (prefix: string) => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
  return `${prefix}-${random.slice(0, 8)}`;
};

type Turn = { raw: string; content: string; reasoning: string[] };

async function turn(
  model: string,
  messages: ChatMessage[],
  onDelta?: (delta: LlmDelta) => void,
  signal?: AbortSignal,
): Promise<Turn> {
  const raw = await browserComplete(model, messages, onDelta, signal);
  const { reasoning, content } = extractReasoning(raw);
  return { raw, content, reasoning };
}

export async function generateViewBrowser(
  payload: Omit<GenerateViewPayload, 'config' | 'widgets'>,
  widgets: WidgetCatalogRequest,
  model: string,
  onDelta?: (delta: LlmDelta) => void,
  signal?: AbortSignal,
) {
  const input = { ...payload, widgets };
  const messages = buildMessages(input);
  const catalog = resolveWidgetCatalog(widgets);
  const first = await turn(model, messages, onDelta, signal);
  let check = validateDraft(first.content, catalog, payload.schema.mutationFields);
  if (!check.ok) {
    const retry = await turn(
      model,
      [...messages, { role: 'assistant', content: first.raw }, buildRepairMessage(check.errorText, first.content)],
      onDelta,
      signal,
    );
    const repaired = validateDraft(retry.content, catalog, payload.schema.mutationFields);
    if (!repaired.ok) throw new Error(`The browser model did not produce a valid view: ${repaired.errorText}`);
    check = repaired;
  }
  return {
    spec: finalizeViewSpec(
      { ...check.draft, scope: check.draft.scope ?? payload.scope },
      { concept: payload.concept, id: newId('gen') },
    ),
    provider: 'browser',
    model,
    reasoning: first.reasoning.length > 0 ? first.reasoning : undefined,
  };
}

export async function generateWidgetBrowser(
  payload: Omit<GenerateWidgetPayload, 'config' | 'widgets'>,
  widgets: WidgetCatalogRequest,
  model: string,
  signal?: AbortSignal,
) {
  const messages = buildWidgetMessages({ ...payload, widgets });
  const catalog = resolveWidgetCatalog(widgets);
  const viewIds = (payload.viewWidgets ?? []).map((w) => w.id);
  const viewActions = Object.keys(payload.viewActions ?? {});
  const widgetId = payload.existingWidget?.id ?? newId('widget');
  const first = await turn(model, messages, undefined, signal);
  let check = validateWidgetDraft(first.content, catalog, viewIds, viewActions);
  if (!check.ok) {
    const retry = await turn(
      model,
      [
        ...messages,
        { role: 'assistant', content: first.raw },
        buildWidgetRepairMessage(check.errorText, first.content),
      ],
      undefined,
      signal,
    );
    const repaired = validateWidgetDraft(retry.content, catalog, viewIds, viewActions);
    if (!repaired.ok) throw new Error(`The browser model did not produce a valid widget: ${repaired.errorText}`);
    check = repaired;
  }
  return {
    widget: finalizeWidget(check.draft, widgetId),
    provider: 'browser',
    model,
    reasoning: first.reasoning.length > 0 ? first.reasoning : undefined,
  };
}

/** One chat answer. A broken inline view is dropped, the text is kept. */
export async function chatBrowser(
  payload: Omit<ChatInput, 'config' | 'widgets'>,
  widgets: WidgetCatalogRequest,
  model: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const messages = buildChatMessages({ ...payload, widgets });
  const catalog = resolveWidgetCatalog(widgets);
  const check = (content: string) => validateChatAnswer(content, catalog, payload.schema.mutationFields);
  const meta = { provider: 'browser', model };
  const first = await turn(model, messages, undefined, signal);
  const firstCheck = check(first.content);
  if (firstCheck.ok) return finalizeChat(payload, firstCheck, meta);

  const repair = buildChatRepairMessage(firstCheck.errorText);
  const second = await turn(
    model,
    [...messages, { role: 'assistant', content: first.raw }, repair],
    undefined,
    signal,
  );
  const retry = check(second.content);
  if (retry.ok) {
    const answer = finalizeChat(payload, retry, meta);
    if (!answer.view && firstCheck.message) answer.message = `${answer.message}\n\n${DROPPED_VIEW_NOTE}`;
    return answer;
  }
  const kept = retry.message ?? firstCheck.message;
  if (kept) {
    return {
      message: `${kept}\n\n${DROPPED_VIEW_NOTE}`,
      suggestView: retry.suggestView ?? firstCheck.suggestView,
      ...meta,
    };
  }
  throw new Error(`The browser model did not produce a valid chat answer: ${retry.errorText}`);
}

function finalizeChat(
  input: Omit<ChatInput, 'config' | 'widgets'>,
  answer: { message: string; suggestView?: boolean; draft?: ViewSpecDraft },
  meta: { provider: string; model: string },
): ChatResponse {
  return {
    message: answer.message,
    view: answer.draft && finalizeViewSpec(answer.draft, { concept: input.concept, id: newId('chat') }),
    suggestView: answer.suggestView,
    ...meta,
  };
}

/** Analysis for the insight widget, with the same schema and repair as the BFF. */
export async function analyzeViewBrowser(
  request: AnalyzeViewRequest,
  model: string,
  signal?: AbortSignal,
): Promise<InsightAnalysis> {
  const messages = buildInsightMessages(request);
  const first = await turn(model, messages, undefined, signal);
  let parsed = parseInsight(first.content);
  if (!parsed.ok) {
    const retry = await turn(
      model,
      [...messages, { role: 'assistant', content: first.raw }, buildInsightRepairMessage(parsed.errorText)],
      undefined,
      signal,
    );
    const repaired = parseInsight(retry.content);
    if (!repaired.ok) throw new Error(`The browser model did not produce a valid analysis: ${repaired.errorText}`);
    parsed = repaired;
  }
  return parsed.analysis;
}
