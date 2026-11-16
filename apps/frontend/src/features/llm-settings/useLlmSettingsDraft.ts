import { useState } from 'react';
import { effectiveProvider } from '../../llm/effectiveProvider';
import { useLlmSettings, type LlmProvider } from '../../store';

export interface LlmSettingsDraft {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Editable copy of the LLM settings, written to the store only on save. While the
 * user has not picked a provider, the draft shows the BFF default.
 */
export function useLlmSettingsDraft(serverDefault: LlmProvider | null) {
  const [raw, setRaw] = useState(() => {
    const { provider, providerChosen, model, apiKey, baseUrl } = useLlmSettings.getState();
    return { provider, providerChosen, model, apiKey, baseUrl };
  });
  const draft: LlmSettingsDraft = {
    provider: effectiveProvider(raw, serverDefault),
    model: raw.model,
    apiKey: raw.apiKey,
    baseUrl: raw.baseUrl,
  };

  const update = (patch: Partial<LlmSettingsDraft>) =>
    setRaw((d) => ({ ...d, ...patch, providerChosen: d.providerChosen || patch.provider !== undefined }));
  // Model names and URLs are provider-specific: start fresh on switch.
  const setProvider = (provider: LlmProvider) => update({ provider, model: '', baseUrl: '' });
  const save = () => useLlmSettings.getState().update({ ...draft, providerChosen: raw.providerChosen });

  return { draft, update, setProvider, save };
}
