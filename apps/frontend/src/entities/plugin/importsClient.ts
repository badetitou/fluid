import type { SarifLog } from '@fluid/shared';
import { parseSarifLog } from './importsModel';

const cache = new Map<string, Promise<SarifLog>>();

/** Fetches a SARIF log; cached by URL for the session (a failure is not cached). */
export function fetchSarifLog(url: string): Promise<SarifLog> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = (async () => {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`The log could not be fetched (HTTP ${res.status}).`);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error('The log is not valid JSON.');
    }
    return parseSarifLog(json);
  })();
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}

/** Forgets the cached logs (tests). */
export function clearSarifCache(): void {
  cache.clear();
}
