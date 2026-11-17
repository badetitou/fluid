import { useCallback } from 'react';
import type { ChatResponse } from '@fluid/shared';
import { postChat, type ChatPayload } from '../../bff/chatApi';
import { currentCatalogRequest } from '../plugin';
import { currentConfig } from './useLlm';

/**
 * One turn of the LLM chat, with the user's provider settings and the widgets
 * of the enabled plugins applied (read when the request starts).
 */
export function useLlmChat() {
  return useCallback(
    async (payload: Omit<ChatPayload, 'config' | 'widgets'>): Promise<ChatResponse> =>
      postChat({ ...payload, widgets: currentCatalogRequest(), config: await currentConfig() }),
    [],
  );
}
