import { useEffect, useMemo, useState } from 'react';
import { useClient } from 'urql';
import type { ViewSpec } from '@fluid/shared';

export interface ViewData {
  /** Query key -> the `data` object returned by that query. */
  results: Record<string, unknown>;
  fetching: boolean;
  error?: Error;
}

/**
 * Runs every named query of a view spec via the urql client and returns the
 * keyed results. Done imperatively (not with `useQuery`) so the number of
 * queries can vary between views without breaking the rules of hooks.
 */
export function useViewData(spec: ViewSpec): ViewData {
  const client = useClient();
  const [state, setState] = useState<ViewData>({ results: {}, fetching: true });

  const queriesKey = useMemo(() => JSON.stringify(spec.queries), [spec.queries]);

  useEffect(() => {
    let cancelled = false;
    setState({ results: {}, fetching: true, error: undefined });

    const entries = Object.entries(spec.queries);
    Promise.all(
      entries.map(([key, q]) =>
        client
          .query(q.query, (q.variables ?? {}) as Record<string, unknown>)
          .toPromise()
          .then((res) => ({ key, res })),
      ),
    )
      .then((settled) => {
        if (cancelled) return;
        const results: Record<string, unknown> = {};
        let error: Error | undefined;
        for (const { key, res } of settled) {
          if (res.error) error = res.error as unknown as Error;
          results[key] = res.data;
        }
        setState({ results, fetching: false, error });
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

  return state;
}
