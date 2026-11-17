import { chatResponseSchema } from '@fluid/shared';
import type { ChatItem, ChatResponse, ChatScope, ChatViewContext, WidgetCatalogRequest } from '@fluid/shared';
import type { ChatMessage, ConceptSchemaPayload, LlmConfigOverrides } from './client';
import { request } from './http';

export interface ChatPayload {
  concept: string;
  schema: ConceptSchemaPayload;
  prompt: string;
  scope: ChatScope;
  view?: ChatViewContext;
  item?: ChatItem;
  widgets?: WidgetCatalogRequest;
  history?: ChatMessage[];
  config?: LlmConfigOverrides;
}

/** One chat turn through the BFF; the answer is validated before it is used. */
export async function postChat(payload: ChatPayload): Promise<ChatResponse> {
  const raw = await request<unknown>('/api/llm/chat', { method: 'POST', body: JSON.stringify(payload) });
  return chatResponseSchema.parse(raw);
}
