import { bffClient } from '../../bff/client';
import { toConfigOverrides } from '../../llm/conceptSchema';
import { effectiveProvider } from '../../llm/effectiveProvider';
import { useLlmSettings } from '../../store';

/** Request config with the provider resolved against the BFF default when the user has not picked one. */
export async function currentConfig() {
  const settings = useLlmSettings.getState();
  const caps = settings.providerChosen ? null : await bffClient.getLlmConfig().catch(() => null);
  return toConfigOverrides({ ...settings, provider: effectiveProvider(settings, caps?.defaultProvider) });
}
