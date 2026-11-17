import type { ChatItem, ChatScope, ChatViewContext, ViewSpec } from '@fluid/shared';
import type { GenerateViewInput, LlmProvider } from './types';

export interface ChatInput extends Omit<GenerateViewInput, 'scope'> {
  scope: ChatScope;
  view?: ChatViewContext;
  item?: ChatItem;
}

export interface ChatResult {
  message: string;
  view?: ViewSpec;
  suggestView?: boolean;
  provider: LlmProvider;
  model: string;
}
