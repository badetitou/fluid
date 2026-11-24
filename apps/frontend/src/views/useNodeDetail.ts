import { useEffect, useMemo, useRef, useState } from 'react';
import { useClient } from 'urql';
import type { ZodType } from 'zod';
import { GRAPH_DETAIL_ID_VARIABLE } from '@fluid/shared';
import { getPath } from './data';
import { useDataSources } from './plugin-api/dataSources';
import { useRenderedView } from './plugin-api/viewContext';
import { queryRunner } from './runQueries';

export interface NodeDetailOptions {
  /** Key of the query in the rendered view spec. */
  queryKey?: string;
  /** Dot path selecting the detail inside the query result. */
  path?: string;
  /** Variable passed to the query as `$nodeId`. */
  nodeId?: string;
  enabled?: boolean;
  /** Validates (and may transform) the selected detail. */
  schema?: ZodType<unknown>;
  /** Replaces the module-level session cache (handy for isolated widgets/tests). */
  cache?: Map<string, unknown>;
}

export interface NodeDetailResult {
  data: unknown;
  loading: boolean;
  error?: Error;
}

interface Fetched {
  key: string;
  data: unknown;
  loading: boolean;
  error?: Error;
}

/** Session memory: a detail is fetched once per query and node until reload. */
const sessionCache = new Map<string, unknown>();

/** Pure read of a cached raw answer: selects `path`, then validates with `schema`. */
export function readNodeDetail(
  cache: ReadonlyMap<string, unknown>,
  key: string,
  path?: string,
  schema?: ZodType<unknown>,
): NodeDetailResult | undefined {
  if (!cache.has(key)) return undefined;
  const value = getPath(cache.get(key), path);
  if (!schema) return { data: value, loading: false };
  const parsed = schema.safeParse(value);
  return parsed.success ? { data: parsed.data, loading: false } : { data: undefined, loading: false, error: parsed.error };
}

/** Runs one named query for one node, caching the answer for the session. */
export function useNodeDetail(options: NodeDetailOptions): NodeDetailResult {
  const { queryKey, path, nodeId, enabled = true, schema, cache } = options;
  const client = useClient();
  const sources = useDataSources();
  const view = useRenderedView();
  const spec = queryKey ? view?.queries[queryKey] : undefined;
  const shouldLoad = enabled !== false && !!spec && !!nodeId;
  const values = cache ?? sessionCache;
  // Two views can use the same query key and node id for different sources: the
  // cache is scoped by view so an expanded node never shows another view's detail.
  const key = queryKey && nodeId ? `${view?.id ?? ''}|${queryKey}|${nodeId}` : '';
  const cached = key ? readNodeDetail(values, key, path, schema) : undefined;

  const [fetched, setFetched] = useState<Fetched>({ key: '', data: undefined, loading: false });
  const current = fetched.key === key ? fetched : undefined;
  const request = useRef(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const specRef = useRef(spec);
  specRef.current = spec;
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const specJson = spec ? JSON.stringify(spec) : '';

  useEffect(() => {
    if (!shouldLoad || !key || valuesRef.current.has(key)) return;
    let cancelled = false;
    const id = ++request.current;
    setFetched({ key, data: undefined, loading: true });
    const q = specRef.current;
    if (!q) return;

    queryRunner(client, sources)({ ...q, variables: { ...q.variables, [GRAPH_DETAIL_ID_VARIABLE]: nodeId } })
      .then((answer) => {
        if (cancelled || id !== request.current) return;
        if (answer.error) {
          setFetched({ key, data: undefined, loading: false, error: answer.error });
          return;
        }
        const value = getPath(answer.data, path);
        const check = schemaRef.current;
        if (check) {
          const parsed = check.safeParse(value);
          if (!parsed.success) {
            setFetched({ key, data: undefined, loading: false, error: parsed.error });
            return;
          }
          valuesRef.current.set(key, answer.data);
          setFetched({ key, data: parsed.data, loading: false });
          return;
        }
        valuesRef.current.set(key, answer.data);
        setFetched({ key, data: value, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled || id !== request.current) return;
        setFetched({ key, data: undefined, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      });

    return () => {
      cancelled = true;
    };
    // spec is captured via its stringified form, schema via a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, sources, key, nodeId, path, shouldLoad, specJson]);

  return useMemo(
    () => ({
      data: current ? current.data : cached?.data,
      loading: current ? current.loading : shouldLoad && !cached,
      error: current ? current.error : cached?.error,
    }),
    [current, cached, shouldLoad],
  );
}
