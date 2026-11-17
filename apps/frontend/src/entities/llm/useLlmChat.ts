import { useCallback } from 'react';
import type { ChatResponse } from '@fluid/shared';
import { postChat, type ChatPayload } from '../../bff/chatApi';
import { currentConfig } from './currentConfig';

/**
 * One turn of the LLM chat, with the user's provider settings applied (read
 * when the request starts). The caller passes the widget catalog.
 */
export function useLlmChat() {
  return useCallback(
    async (payload: Omit<ChatPayload, 'config'>): Promise<ChatResponse> =>
      postChat({ ...payload, config: await currentConfig() }),
    [],
  );
}
