import type { ChatItem, ChatResponse, ChatScope, ChatViewContext } from '..';
import type { GenerateViewInput } from './types';

export interface ChatInput extends Omit<GenerateViewInput, 'scope'> {
  scope: ChatScope;
  view?: ChatViewContext;
  item?: ChatItem;
}

/** The response contract lives in @fluid/shared. */
export type ChatResult = ChatResponse;
