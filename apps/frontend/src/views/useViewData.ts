import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClient, type Client, type RequestPolicy } from 'urql';
import type { QuerySpec, ViewSpec } from '@fluid/shared';
import { useDataSources, type DataSource } from './plugin-api/dataSources';

export interface ViewData {
  /** Query key -> the `data` object returned by that query. */
  results: Record<string, unknown>;
  fetching: boolean;
  /**
   * The queries are running again with other variables (another item of the
   * same view): `results` still holds the previous ones, shown until replaced.
   */
  refreshing?: boolean;
  error?: Error;
}

export interface ViewDataControls {
  /** Rewrites the results in place (after a mutation, before any refetch). */
  patch: (update: (results: Record<string, unknown>) => Record<string, unknown>) => void;
  /** Fetches the given queries again from the network; their results replace the current ones. */
  refetch: (keys: string[]) => Promise<void>;
}

type Settled = { results: Record<string, unknown>; error?: Error };
type Answer = { data?: unknown; error?: Error };

/** Runs one query: on the GraphQL source, or on the data source it names. */
function runQuery(client: Client, sources: ReadonlyMap<string, DataSource>, q: QuerySpec, requestPolicy?: RequestPolicy): Promise<Answer> {
  const variables = (q.variables ?? {}) as Record<string, unknown>;
  if (q.source) {
    const source = sources.get(q.source);
    if (!source) return Promise.resolve({ error: new Error(`The data source “${q.source}” is not available: enable its plugin in Settings → Plugins.`) });
    return source.run(q.query, variables).then(
      (data) => ({ data }),
      (err: unknown) => ({ error: err instanceof Error ? err : new Error(String(err)) }),
    );
  }
  return client
    .query(q.query, variables, requestPolicy ? { requestPolicy } : undefined)
    .toPromise()
    .then((res) => ({ data: res.data, error: res.error as unknown as Error | undefined }));
}

/** Runs the given named queries and gathers their results (the last error wins). */
async function runQueries(client: Client, sources: ReadonlyMap<string, DataSource>, entries: [string, QuerySpec][], requestPolicy?: RequestPolicy): Promise<Settled> {
  const settled = await Promise.all(
    entries.map(([key, q]) => runQuery(client, sources, q, requestPolicy).then((res) => ({ key, res }))),
  );
  const results: Record<string, unknown> = {};
  let error: Error | undefined;
  for (const { key, res } of settled) {
    if (res.error) error = res.error;
    results[key] = res.data;
  }
  return { results, error };
}

/**
 * Runs every named query of a view spec (via the urql client, or the data
 * source a query names) and returns the keyed results. Done imperatively (not with `useQuery`) so the number of
 * queries can vary between views without breaking the rules of hooks.
 */
export function useViewData(spec: ViewSpec): ViewData & ViewDataControls {
  const client = useClient();
  const sources = useDataSources();
  const [state, setState] = useState<ViewData>({ results: {}, fetching: true });

  const queriesKey = useMemo(() => JSON.stringify(spec.queries), [spec.queries]);

  useEffect(() => {
    let cancelled = false;
    // Once loaded, keep the results on screen while the new ones arrive.
    setState((s) => (s.fetching ? s : { ...s, refreshing: true }));

    runQueries(client, sources, Object.entries(spec.queries))
      .then(({ results, error }) => {
        if (!cancelled) setState({ results, fetching: false, refreshing: false, error });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ results: {}, fetching: false, refreshing: false, error: err as Error });
      });

    return () => {
      cancelled = true;
    };
    // spec.queries is captured via its stable stringified form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, sources, queriesKey]);

  const patch = useCallback<ViewDataControls['patch']>(
    (update) => setState((s) => ({ ...s, results: update(s.results) })),
    [],
  );

  const refetch = useCallback<ViewDataControls['refetch']>(
    async (keys) => {
      const entries = Object.entries(spec.queries).filter(([key]) => keys.includes(key));
      if (entries.length === 0) return;
      const { results, error } = await runQueries(client, sources, entries, 'network-only');
      setState((s) => ({ ...s, results: { ...s.results, ...results }, error: error ?? s.error }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, sources, queriesKey],
  );

  // Stable between renders while nothing changed: widget cards are memoised on it.
  return useMemo(() => ({ ...state, patch, refetch }), [state, patch, refetch]);
}
