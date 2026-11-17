import type { Client, RequestPolicy } from 'urql';
import type { QuerySpec } from '@fluid/shared';
import type { DataSource } from './plugin-api/dataSources';
import { fetchRows, type Answer, type PagedAnswer, type Runner } from './paging/fetchRows';
import type { RowPaging, RowsState } from './paging/model';

export interface Settled {
  results: Record<string, unknown>;
  /** What is loaded of the rows of the paged queries, by query key. */
  rows: Record<string, RowsState>;
  error?: Error;
}

/** Runs one query: on the GraphQL source, or on the data source it names. */
export function queryRunner(client: Client, sources: ReadonlyMap<string, DataSource>, requestPolicy?: RequestPolicy): Runner {
  return (q: QuerySpec): Promise<Answer> => {
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
  };
}

/** Runs the given named queries, the first rows (or `atLeast`) of the paged ones, and gathers the results (the last error wins). */
export async function runQueries(
  run: Runner,
  entries: [string, QuerySpec][],
  paging: RowPaging,
  /** Query key -> rows loaded before (a refetch loads as many again). */
  atLeast: Record<string, number> = {},
): Promise<Settled> {
  const settled = await Promise.all(
    entries.map(([key, q]) => {
      // A data source of a plugin is not a GraphQL list to page.
      const answer: Promise<PagedAnswer> = q.source ? run(q) : fetchRows(run, q, paging, { kind: 'first', atLeast: atLeast[key] });
      return answer.then((res) => ({ key, res }));
    }),
  );
  const results: Record<string, unknown> = {};
  const rows: Record<string, RowsState> = {};
  let error: Error | undefined;
  for (const { key, res } of settled) {
    if (res.error) error = res.error;
    results[key] = res.data;
    if (res.rows) rows[key] = res.rows;
  }
  return { results, rows, error };
}
