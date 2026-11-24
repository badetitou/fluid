import { useCallback } from 'react';
import type { ChatResponse } from '@fluid/shared';
import { postChat, type ChatPayload } from '../../bff/chatApi';
import { chatBrowser } from '../../llm/browser/browserFlows';
import { browserModel } from '../../llm/browser/browserEngine';
import { useLlmSettings } from '../../store';
import { currentCatalogRequest } from '../plugin';
import { currentConfig } from './currentConfig';

/**
 * One turn of the LLM chat, with the user's provider settings applied (read
 * when the request starts). The caller passes the widget catalog.
 */
export function useLlmChat() {
  return useCallback(
    async (payload: Omit<ChatPayload, 'config'>): Promise<ChatResponse> => {
      const settings = useLlmSettings.getState();
      const widgets = payload.widgets ?? currentCatalogRequest();
      if (settings.provider === 'browser') {
        return chatBrowser(payload, widgets, browserModel(settings.model));
      }
      return postChat({ ...payload, config: await currentConfig() });
    },
    [],
  );
}
