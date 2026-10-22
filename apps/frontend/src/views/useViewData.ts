import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClient, type Client, type RequestPolicy } from 'urql';
import type { QuerySpec, ViewSpec } from '@fluid/shared';

export interface ViewData {
  /** Query key -> the `data` object returned by that query. */
  results: Record<string, unknown>;
  fetching: boolean;
  error?: Error;
}

export interface ViewDataControls {
  /** Rewrites the results in place (after a mutation, before any refetch). */
  patch: (update: (results: Record<string, unknown>) => Record<string, unknown>) => void;
  /** Fetches the given queries again from the network; their results replace the current ones. */
  refetch: (keys: string[]) => Promise<void>;
}

type Settled = { results: Record<string, unknown>; error?: Error };

/** Runs the given named queries and gathers their results (the last error wins). */
async function runQueries(client: Client, entries: [string, QuerySpec][], requestPolicy?: RequestPolicy): Promise<Settled> {
  const settled = await Promise.all(
    entries.map(([key, q]) =>
      client
        .query(q.query, (q.variables ?? {}) as Record<string, unknown>, requestPolicy ? { requestPolicy } : undefined)
        .toPromise()
        .then((res) => ({ key, res })),
    ),
  );
  const results: Record<string, unknown> = {};
  let error: Error | undefined;
  for (const { key, res } of settled) {
    if (res.error) error = res.error as unknown as Error;
    results[key] = res.data;
  }
  return { results, error };
}

/**
 * Runs every named query of a view spec via the urql client and returns the
 * keyed results. Done imperatively (not with `useQuery`) so the number of
 * queries can vary between views without breaking the rules of hooks.
 */
export function useViewData(spec: ViewSpec): ViewData & ViewDataControls {
  const client = useClient();
  const [state, setState] = useState<ViewData>({ results: {}, fetching: true });

  const queriesKey = useMemo(() => JSON.stringify(spec.queries), [spec.queries]);

  useEffect(() => {
    let cancelled = false;
    setState({ results: {}, fetching: true, error: undefined });

    runQueries(client, Object.entries(spec.queries))
      .then(({ results, error }) => {
        if (!cancelled) setState({ results, fetching: false, error });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ results: {}, fetching: false, error: err as Error });
      });

    return () => {
      cancelled = true;
    };
    // spec.queries is captured via its stable stringified form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queriesKey]);

  const patch = useCallback<ViewDataControls['patch']>(
    (update) => setState((s) => ({ ...s, results: update(s.results) })),
    [],
  );

  const refetch = useCallback<ViewDataControls['refetch']>(
    async (keys) => {
      const entries = Object.entries(spec.queries).filter(([key]) => keys.includes(key));
      if (entries.length === 0) return;
      const { results, error } = await runQueries(client, entries, 'network-only');
      setState((s) => ({ ...s, results: { ...s.results, ...results }, error: error ?? s.error }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, queriesKey],
  );

  // Stable between renders while nothing changed: widget cards are memoised on it.
  return useMemo(() => ({ ...state, patch, refetch }), [state, patch, refetch]);
}
