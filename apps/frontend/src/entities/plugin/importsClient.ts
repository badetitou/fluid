import type { SarifLog } from '@fluid/shared';
import { fetchJson } from './fetchJson';
import { parseSarifLog } from './importsModel';

const cache = new Map<string, Promise<SarifLog>>();

/** Fetches a SARIF log; cached by URL for the session (a failure is not cached). */
export function fetchSarifLog(url: string): Promise<SarifLog> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = fetchJson(url, 'log').then(parseSarifLog);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}

/** Forgets the cached logs (tests). */
export function clearSarifCache(): void {
  cache.clear();
}
