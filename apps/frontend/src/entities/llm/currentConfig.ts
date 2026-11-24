import { bffClient } from '../../bff/client';
import { toConfigOverrides } from '../../llm/conceptSchema';
import { effectiveProvider } from '../../llm/effectiveProvider';
import { useLlmSettings } from '../../store';

/** Request config with the provider resolved against the BFF default when the user has not picked one. */
export async function currentConfig() {
  const settings = useLlmSettings.getState();
  const caps = settings.providerChosen ? null : await bffClient.getLlmConfig().catch(() => null);
  const provider = effectiveProvider(settings, caps?.defaultProvider);
  // Guard rail: the WebGPU provider runs entirely in the tab. Never let its
  // settings (a WebLLM model id that the BFF does not know) reach the server.
  if (provider === 'browser') throw new Error('The browser provider runs locally and cannot be sent to the BFF');
  return toConfigOverrides({ ...settings, provider });
}
