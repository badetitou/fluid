import { useEffect, useMemo, useState } from 'react';
import type { SarifLog } from '@fluid/shared';
import type { DecoratorEntry } from './graphDecorator';
import { fetchSarifLog } from './importsClient';
import { importRequests } from './importsModel';

export interface ImportedLogs {
  /** Loaded logs, keyed `${spec.id}/${import.id}`. */
  imported: ReadonlyMap<string, SarifLog>;
  /** Why an import failed, by the same key. */
  errors: Readonly<Record<string, string>>;
}

interface Outcome {
  url: string;
  log?: SarifLog;
  error?: string;
}

/** Fetches the SARIF logs the decorators import; each is cached by URL for the session. */
export function useImportedLogs(entries: DecoratorEntry[]): ImportedLogs {
  const { requests, errors: invalid } = useMemo(() => importRequests(entries, window.location.origin), [entries]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  useEffect(() => {
    let live = true;
    void Promise.all(
      requests.map(async ({ key, url }): Promise<[string, Outcome]> => {
        try {
          return [key, { url, log: await fetchSarifLog(url) }];
        } catch (e) {
          return [key, { url, error: e instanceof Error ? e.message : String(e) }];
        }
      }),
    ).then((settled) => {
      if (live) setOutcomes(Object.fromEntries(settled));
    });
    return () => {
      live = false;
    };
  }, [requests]);

  // Only what is requested now: an import that was dropped (or whose URL changed) vanishes at once.
  return useMemo(() => {
    const imported = new Map<string, SarifLog>();
    const errors: Record<string, string> = { ...invalid };
    for (const { key, url } of requests) {
      const outcome = outcomes[key];
      if (outcome?.url !== url) continue;
      if (outcome.log) imported.set(key, outcome.log);
      else if (outcome.error) errors[key] = outcome.error;
    }
    return { imported, errors };
  }, [requests, outcomes, invalid]);
}
