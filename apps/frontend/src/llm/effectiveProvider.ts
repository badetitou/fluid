import type { LlmProvider } from '../store';

/**
 * The provider the assistant uses: the one the user picked and saved, else the
 * BFF's default, else (BFF unreachable) the locally stored one (`mock` initially).
 */
export function effectiveProvider(
  settings: { provider: LlmProvider; providerChosen: boolean },
  serverDefault: LlmProvider | null | undefined,
): LlmProvider {
  if (settings.providerChosen) return settings.provider;
  return serverDefault ?? settings.provider;
}
