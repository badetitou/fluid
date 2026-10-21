import { useCallback, useEffect, useState } from 'react';
import {
  bffClient,
  type GenerateViewPayload,
  type GenerateWidgetPayload,
  type LlmCapabilities,
  type LlmDelta,
} from '../../bff/client';
import { toConfigOverrides } from '../../llm/conceptSchema';
import { useLlmSettings } from '../../store';

type WithoutConfig<T> = Omit<T, 'config'>;

/**
 * LLM generation through the BFF, with the user's provider settings applied.
 * Settings are read when a request starts, so the callbacks stay stable.
 */
export function useLlmGenerate() {
  const generateView = useCallback(
    (payload: WithoutConfig<GenerateViewPayload>, onDelta: (d: LlmDelta) => void, signal?: AbortSignal) =>
      bffClient.generateViewStream(
        { ...payload, config: toConfigOverrides(useLlmSettings.getState()) },
        onDelta,
        signal,
      ),
    [],
  );
  const generateWidget = useCallback(
    (payload: WithoutConfig<GenerateWidgetPayload>) =>
      bffClient.generateWidget({ ...payload, config: toConfigOverrides(useLlmSettings.getState()) }),
    [],
  );
  return { generateView, generateWidget };
}

/** What the BFF can generate with, fetched each time `active` turns true; null when unknown. */
export function useLlmCapabilities(active: boolean): LlmCapabilities | null {
  const [caps, setCaps] = useState<LlmCapabilities | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    bffClient
      .getLlmConfig()
      .then((c) => !cancelled && setCaps(c))
      .catch(() => !cancelled && setCaps(null));
    return () => {
      cancelled = true;
    };
  }, [active]);
  return caps;
}
