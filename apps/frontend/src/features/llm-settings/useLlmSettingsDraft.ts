import { useState } from 'react';
import { useLlmSettings, type LlmProvider } from '../../store';

export interface LlmSettingsDraft {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/** Editable copy of the LLM settings, written to the store only on save. */
export function useLlmSettingsDraft() {
  const [draft, setDraft] = useState<LlmSettingsDraft>(() => {
    const { provider, model, apiKey, baseUrl } = useLlmSettings.getState();
    return { provider, model, apiKey, baseUrl };
  });

  const update = (patch: Partial<LlmSettingsDraft>) => setDraft((d) => ({ ...d, ...patch }));
  // Model names and URLs are provider-specific: start fresh on switch.
  const setProvider = (provider: LlmProvider) => update({ provider, model: '', baseUrl: '' });
  const save = () => useLlmSettings.getState().update(draft);

  return { draft, update, setProvider, save };
}
