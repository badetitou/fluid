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

/**
 * What to load: the first rows (`atLeast` keeps as many as were loaded, on a
 * refetch), `'more'` after what is there, or everything (`'all'`).
 */
export type RowsRequest = { kind: 'first'; atLeast?: number } | { kind: 'more' | 'all'; data: unknown; rows: RowsState };

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

/** Rows to reach: `step` more, everything, or (first load) the row limit or what was loaded before. */
function targetOf(request: RowsRequest, step: number): number {
  if (request.kind === 'first') return Math.max(step, request.atLeast ?? 0);
  return request.kind === 'all' ? ALL_ROWS : request.rows.loaded + step;
}

/**
 * Loads the rows of a paged query (one declaring `$take`); other queries are
 * run as they are. With an offset argument, rows are read page by page (at most
 * `maxPerRequest` each); without, the query runs again with a bigger take, up
 * to what the source answers at most.
 */
export async function fetchRows(run: Runner, q: QuerySpec, paging: RowPaging, request: RowsRequest = { kind: 'first' }): Promise<PagedAnswer> {
  const step = firstTake(q, paging);
  if (!step || !isPaged(q.query)) return run(q);
  const paths = pagedPaths(q.query);
  const before = request.kind === 'first' ? undefined : request;
  const from = before?.rows.loaded ?? 0;
  const target = targetOf(request, step);
  const cap = paging.maxPerRequest;
  const offsetQuery = paging.offsetArg ? withOffset(q.query, paging.offsetArg) : null;
  // Pages of `step` for a "load more", else as large as the source answers.
  const size = cap ? (request.kind === 'more' ? Math.min(cap, step) : cap) : step;

  let pages = offsetQuery !== null;
  // Page when the source can and one request would not do (or rows are already there).
  if (offsetQuery && (from > 0 || target > size)) {
    const res = await pageFrom(run, q, offsetQuery, { data: before?.data, from }, target, size, paths);
    const loaded = countRows(res.data, paths);
    // Refused from the first page: this field has no offset argument, ask a bigger take instead.
    pages = !(res.error && loaded === from);
    if (pages) {
      const truncated = !res.short && !res.error;
      return { data: res.data, error: res.error, rows: { loaded, truncated, step, paged: true, more: truncated } };
    }
  }

  // One request: never more than the source answers at once.
  const take = cap ? Math.min(target, cap) : target;
  const res = await run({ ...q, variables: { ...q.variables, take } });
  // A failed "more" or "all" keeps the rows already there.
  if (before && (res.error || res.data === undefined)) return { data: before.data, error: res.error, rows: before.rows };
  const loaded = countRows(res.data, paths);
  const truncated = mayBeTruncated(loaded, take, cap);
  // Without an offset, more rows only come from a bigger take: not past the cap, nor when nothing grew.
  const more = truncated && (pages || (loaded > from && (!cap || loaded < cap)));
  return { ...res, rows: { loaded, truncated, step, paged: pages, more } };
}
