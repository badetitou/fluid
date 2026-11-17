import { describe, expect, it, vi } from 'vitest';
import type { QuerySpec } from '@fluid/shared';
import { fetchRows, type Runner } from './fetchRows';
import { ALL_ROWS } from './model';

const QUERY = 'query L($take: Int) { methods(take: $take) { name } }';
const q: QuerySpec = { query: QUERY, variables: { take: 100 } };

/** A source of `total` rows, answering at most `max` per request, with `skip` when `offset`. */
function source(total: number, max: number, offset = true) {
  const run = vi.fn<Runner>(async (spec) => {
    const vars = (spec.variables ?? { take: total }) as { take: number; fluidSkip?: number };
    const skip = offset ? (vars.fluidSkip ?? 0) : 0;
    const n = Math.max(0, Math.min(vars.take, max, total - skip));
    return { data: { methods: Array.from({ length: n }, (_, i) => ({ name: `m${skip + i}` })) } };
  });
  return run;
}

describe('fetchRows', () => {
  it('runs queries without $take as they are', async () => {
    const run = source(10, 10);
    const plain = { query: '{ methods { name } }' };
    await fetchRows(run, plain, {});
    expect(run).toHaveBeenCalledWith(plain);
  });

  it('asks the row limit and tells when the answer may be cut', async () => {
    const run = source(5000, 1000);
    const res = await fetchRows(run, q, { rowLimit: 500 });
    expect(run.mock.calls[0][0].variables).toEqual({ take: 500 });
    expect(res.rows).toEqual({ loaded: 500, truncated: true, step: 500 });
  });

  it('is not cut when the source has fewer rows', async () => {
    const res = await fetchRows(source(42, 1000), q, {});
    expect(res.rows).toEqual({ loaded: 42, truncated: false, step: 100 });
  });

  it('pages up to the row limit when it is above what the source answers per request', async () => {
    const run = source(5000, 1000);
    const res = await fetchRows(run, q, { rowLimit: 2500, maxPerRequest: 1000, offsetArg: 'skip' });
    expect(run).toHaveBeenCalledTimes(3);
    expect(res.rows).toMatchObject({ loaded: 2500, truncated: true });
  });

  it('loads more after the rows already there, with the offset argument', async () => {
    const run = source(150, 1000);
    const first = await fetchRows(run, q, { offsetArg: 'skip' });
    const more = await fetchRows(run, q, { offsetArg: 'skip' }, { kind: 'more', data: first.data, rows: first.rows! });
    expect(run.mock.calls[1][0].variables).toEqual({ take: 100, fluidSkip: 100 });
    expect(run.mock.calls[1][0].query).toContain('skip: $fluidSkip');
    expect(more.rows).toEqual({ loaded: 150, truncated: false, step: 100 });
    expect((more.data as { methods: { name: string }[] }).methods[149].name).toBe('m149');
  });

  it('loads all page by page until a short page', async () => {
    const run = source(2300, 1000);
    const first = await fetchRows(run, q, { maxPerRequest: 1000, offsetArg: 'skip' });
    const all = await fetchRows(run, q, { maxPerRequest: 1000, offsetArg: 'skip' }, { kind: 'all', data: first.data, rows: first.rows! });
    expect(all.rows).toMatchObject({ loaded: 2300, truncated: false });
  });

  it('without an offset argument, asks every row at once and stays cut at the source cap', async () => {
    const run = source(5000, 1000, false);
    const first = await fetchRows(run, q, { maxPerRequest: 1000 });
    const all = await fetchRows(run, q, { maxPerRequest: 1000 }, { kind: 'all', data: first.data, rows: first.rows! });
    expect(run.mock.calls[1][0].variables).toEqual({ take: ALL_ROWS });
    expect(all.rows).toMatchObject({ loaded: 1000, truncated: true });
  });

  it('asks a bigger take when the paged field refuses the offset argument', async () => {
    const plain = source(5000, 1000, false);
    const run = vi.fn<Runner>(async (spec) =>
      spec.query.includes('fluidSkip') ? { error: new Error('Unknown argument "skip"') } : plain(spec),
    );
    const first = await fetchRows(run, q, { offsetArg: 'skip' });
    const more = await fetchRows(run, q, { offsetArg: 'skip' }, { kind: 'more', data: first.data, rows: first.rows! });
    expect(run.mock.calls.at(-1)![0].variables).toEqual({ take: 200 });
    expect(more.error).toBeUndefined();
    expect(more.rows).toMatchObject({ loaded: 200, truncated: true });
  });
});
