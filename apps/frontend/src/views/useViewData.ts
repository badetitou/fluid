import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClient } from 'urql';
import type { ViewSpec } from '@fluid/shared';
import { useDataSources } from './plugin-api/dataSources';
import { useRowPaging } from './plugin-api/rowPaging';
import { fetchRows } from './paging/fetchRows';
import type { RowPaging, RowsState } from './paging/model';
import { queryRunner, runQueries } from './runQueries';

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
  /** Query key -> what is loaded of its rows, for the queries paged with `$take`. */
  rows?: Record<string, RowsState>;
  /** Loads more rows, or all of them, of a paged query (see `rows`). */
  loadRows?: (key: string, kind: 'more' | 'all') => Promise<void>;
}

export interface ViewDataControls {
  /** Rewrites the results in place (after a mutation, before any refetch). */
  patch: (update: (results: Record<string, unknown>) => Record<string, unknown>) => void;
  /** Fetches the given queries again from the network; their results replace the current ones. */
  refetch: (keys: string[]) => Promise<void>;
}

/**
 * Runs every named query of a view spec (via the urql client, or the data
 * source a query names) and returns the keyed results. Done imperatively (not with `useQuery`) so the number of
 * queries can vary between views without breaking the rules of hooks.
 * Queries declaring `$take` are paged with the source's row limit (see `paging/`).
 */
export function useViewData(spec: ViewSpec): ViewData & ViewDataControls {
  const client = useClient();
  const sources = useDataSources();
  const { rowLimit, maxPerRequest, offsetArg } = useRowPaging();
  const paging = useMemo<RowPaging>(() => ({ rowLimit, maxPerRequest, offsetArg }), [rowLimit, maxPerRequest, offsetArg]);
  const [state, setState] = useState<ViewData>({ results: {}, fetching: true });
  const latest = useRef(state);
  latest.current = state;

  const queriesKey = useMemo(() => JSON.stringify(spec.queries), [spec.queries]);

  useEffect(() => {
    let cancelled = false;
    // Once loaded, keep the results on screen while the new ones arrive.
    setState((s) => (s.fetching ? s : { ...s, refreshing: true }));

    runQueries(queryRunner(client, sources), Object.entries(spec.queries), paging)
      .then(({ results, rows, error }) => {
        if (!cancelled) setState({ results, rows, fetching: false, refreshing: false, error });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ results: {}, fetching: false, refreshing: false, error: err as Error });
      });

    return () => {
      cancelled = true;
    };
    // spec.queries is captured via its stable stringified form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, sources, queriesKey, paging]);

  const patch = useCallback<ViewDataControls['patch']>(
    (update) => setState((s) => ({ ...s, results: update(s.results) })),
    [],
  );

  const refetch = useCallback<ViewDataControls['refetch']>(
    async (keys) => {
      const entries = Object.entries(spec.queries).filter(([key]) => keys.includes(key));
      if (entries.length === 0) return;
      const { results, rows, error } = await runQueries(queryRunner(client, sources, 'network-only'), entries, paging);
      setState((s) => ({ ...s, results: { ...s.results, ...results }, rows: { ...s.rows, ...rows }, error: error ?? s.error }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, sources, queriesKey, paging],
  );

  const loadRows = useCallback<NonNullable<ViewData['loadRows']>>(
    async (key, kind) => {
      const q = spec.queries[key];
      const rows = latest.current.rows?.[key];
      if (!q || !rows) return;
      const request = { kind, data: latest.current.results[key], rows };
      const res = await fetchRows(queryRunner(client, sources), q, paging, request);
      setState((s) => ({
        ...s,
        results: { ...s.results, [key]: res.data },
        rows: res.rows ? { ...s.rows, [key]: res.rows } : s.rows,
        error: res.error ?? s.error,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, sources, queriesKey, paging],
  );

  // Stable between renders while nothing changed: widget cards are memoised on it.
  return useMemo(() => ({ ...state, loadRows, patch, refetch }), [state, loadRows, patch, refetch]);
}
