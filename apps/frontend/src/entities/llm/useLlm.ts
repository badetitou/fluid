import { useCallback, useEffect, useState } from 'react';
import type { AnalyzeViewRequest } from '@fluid/shared';
import {
  bffClient,
  type GenerateViewPayload,
  type GenerateWidgetPayload,
  type LlmCapabilities,
  type LlmDelta,
} from '../../bff/client';
import { toConfigOverrides } from '../../llm/conceptSchema';
import { effectiveProvider } from '../../llm/effectiveProvider';
import { useLlmSettings, type LlmProvider } from '../../store';
import { currentCatalogRequest } from '../plugin';
import { analyzeView } from './analyzeView';

/** Request config with the provider resolved against the BFF default when the user has not picked one. */
async function currentConfig() {
  const settings = useLlmSettings.getState();
  const caps = settings.providerChosen ? null : await bffClient.getLlmConfig().catch(() => null);
  return toConfigOverrides({ ...settings, provider: effectiveProvider(settings, caps?.defaultProvider) });
}

type WithoutConfig<T> = Omit<T, 'config' | 'widgets'>;

/**
 * LLM generation through the BFF, with the user's provider settings and the
 * widgets of the enabled plugins applied. Both are read when a request starts,
 * so the callbacks stay stable.
 */
export function useLlmGenerate() {
  const generateView = useCallback(
    async (payload: WithoutConfig<GenerateViewPayload>, onDelta: (d: LlmDelta) => void, signal?: AbortSignal) =>
      bffClient.generateViewStream(
        { ...payload, widgets: currentCatalogRequest(), config: await currentConfig() },
        onDelta,
        signal,
      ),
    [],
  );
  const generateWidget = useCallback(
    async (payload: WithoutConfig<GenerateWidgetPayload>) =>
      bffClient.generateWidget({
        ...payload,
        widgets: currentCatalogRequest(),
        config: await currentConfig(),
      }),
    [],
  );
  return { generateView, generateWidget };
}

/** Analyses a view for the insight widget, with the user's provider settings (read per request). */
export function useLlmInsightAnalyzer() {
  return useCallback(
    async (request: AnalyzeViewRequest, signal?: AbortSignal) => analyzeView(request, await currentConfig(), signal),
    [],
  );
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

/** The provider in effect (user's choice, else the BFF default), for display. */
export function useEffectiveProvider(): LlmProvider {
  const caps = useLlmCapabilities(true);
  const provider = useLlmSettings((s) => s.provider);
  const providerChosen = useLlmSettings((s) => s.providerChosen);
  return effectiveProvider({ provider, providerChosen }, caps?.defaultProvider);
}
