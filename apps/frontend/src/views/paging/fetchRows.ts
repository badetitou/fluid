import type { QuerySpec } from '@fluid/shared';
import {
  ALL_ROWS,
  countRows,
  isPaged,
  mayBeTruncated,
  mergePages,
  pagedPaths,
  SKIP_VARIABLE,
  withOffset,
  type RowPaging,
  type RowsState,
} from './model';

export type Answer = { data?: unknown; error?: Error };
/** Runs one query with the given variables. */
export type Runner = (q: QuerySpec) => Promise<Answer>;

/** One paged answer: the data and what is loaded of its rows. */
export interface PagedAnswer extends Answer {
  rows?: RowsState;
}

/** What to load: everything (`'all'`), `'more'` after what is there, or the first rows. */
export type RowsRequest = { kind: 'first' } | { kind: 'more' | 'all'; data: unknown; rows: RowsState };

/** Safety net: a source that never answers a short page is not paged forever. */
const MAX_PAGES = 1000;

/** Rows asked at first: the source's row limit, else the view's own `take`. */
export function firstTake(q: QuerySpec, paging: RowPaging): number | undefined {
  if (paging.rowLimit) return paging.rowLimit;
  const take = q.variables?.take;
  return typeof take === 'number' && take > 0 ? take : undefined;
}

/** Pages with the offset argument from `from` until `target` rows or a short page. */
async function pageFrom(run: Runner, q: QuerySpec, offsetQuery: string, start: { data: unknown; from: number }, target: number, size: number, paths: string[][]): Promise<PagedAnswer & { short: boolean }> {
  let { data, from } = start;
  for (let page = 0; page < MAX_PAGES && from < target; page++) {
    const take = Math.min(size, target - from);
    const res = await run({ ...q, query: offsetQuery, variables: { ...q.variables, take, [SKIP_VARIABLE]: from } });
    if (res.error) return { data, error: res.error, short: false };
    const got = countRows(res.data, paths);
    data = data === undefined ? res.data : mergePages(data, res.data, paths);
    from += got;
    if (got < take) return { data, short: true };
  }
  return { data, short: false };
}

/**
 * Loads the rows of a paged query (one declaring `$take`); other queries are
 * run as they are. With an offset argument, rows are read page by page (at most
 * `maxPerRequest` each); without, the query runs again with a bigger take.
 */
export async function fetchRows(run: Runner, q: QuerySpec, paging: RowPaging, request: RowsRequest = { kind: 'first' }): Promise<PagedAnswer> {
  const step = firstTake(q, paging);
  if (!step || !isPaged(q.query)) return run(q);
  const paths = pagedPaths(q.query);
  const from = request.kind === 'first' ? 0 : request.rows.loaded;
  const target = request.kind === 'all' ? ALL_ROWS : from + step;
  const offsetQuery = paging.offsetArg ? withOffset(q.query, paging.offsetArg) : null;
  const size = paging.maxPerRequest ? Math.min(paging.maxPerRequest, request.kind === 'all' ? paging.maxPerRequest : step) : step;

  // Page when the source can and one request would not do (or rows are already there).
  if (offsetQuery && (from > 0 || target > size)) {
    const start = { data: request.kind === 'first' ? undefined : request.data, from };
    const res = await pageFrom(run, q, offsetQuery, start, target, size, paths);
    const loaded = countRows(res.data, paths);
    // Refused from the first page: this field has no offset argument, ask a bigger take instead.
    const refused = res.error && loaded === from;
    if (!refused) return { data: res.data, error: res.error, rows: { loaded, truncated: !res.short && !res.error, step } };
  }

  const res = await run({ ...q, variables: { ...q.variables, take: target } });
  // A failed "more" or "all" keeps the rows already there.
  if (request.kind !== 'first' && (res.error || res.data === undefined)) {
    return { data: request.data, error: res.error, rows: request.rows };
  }
  const loaded = countRows(res.data, paths);
  return { ...res, rows: { loaded, truncated: mayBeTruncated(loaded, target, paging.maxPerRequest), step } };
}
