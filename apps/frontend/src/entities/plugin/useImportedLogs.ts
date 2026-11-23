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

const NONE: ImportedLogs = { imported: new Map(), errors: {} };

/** Fetches the SARIF logs the decorators import; each is cached by URL for the session. */
export function useImportedLogs(entries: DecoratorEntry[]): ImportedLogs {
  const { requests, errors: invalid } = useMemo(() => importRequests(entries, window.location.origin), [entries]);
  const [state, setState] = useState<ImportedLogs>(NONE);

  useEffect(() => {
    if (requests.length === 0) {
      setState(NONE);
      return;
    }
    let live = true;
    void Promise.all(
      requests.map(async ({ key, url }) => {
        try {
          return { key, log: await fetchSarifLog(url), error: undefined };
        } catch (e) {
          return { key, log: undefined, error: e instanceof Error ? e.message : String(e) };
        }
      }),
    ).then((results) => {
      if (!live) return;
      const imported = new Map<string, SarifLog>();
      const errors: Record<string, string> = {};
      for (const r of results) {
        if (r.log) imported.set(r.key, r.log);
        else errors[r.key] = r.error ?? 'failed';
      }
      setState({ imported, errors });
    });
    return () => {
      live = false;
    };
  }, [requests]);

  return useMemo(() => ({ imported: state.imported, errors: { ...invalid, ...state.errors } }), [state, invalid]);
}
