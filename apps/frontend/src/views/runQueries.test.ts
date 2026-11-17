import { describe, expect, it, vi } from 'vitest';
import type { QuerySpec } from '@fluid/shared';
import type { Runner } from './paging/fetchRows';
import { runQueries } from './runQueries';

const PAGED: QuerySpec = { query: 'query L($take: Int) { methods(take: $take) { name } }', variables: { take: 10 } };

/** Answers as many rows as asked (`take`), out of 1000. */
const run = vi.fn<Runner>(async (q) => {
  const take = (q.variables as { take?: number } | undefined)?.take ?? 1000;
  return { data: { methods: Array.from({ length: Math.min(take, 1000) }, (_, i) => ({ name: `m${i}` })) } };
});

describe('runQueries', () => {
  it('pages the queries declaring $take, and only them', async () => {
    const plain = { query: '{ methods { name } }' };
    const res = await runQueries(run, [['paged', PAGED], ['plain', plain]], { rowLimit: 20 });
    expect(Object.keys(res.rows)).toEqual(['paged']);
    expect(res.rows.paged).toMatchObject({ loaded: 20, truncated: true });
    expect(res.results.plain).toBeDefined();
  });

  it('runs the queries of a plugin data source as they are, without rows', async () => {
    const fromPlugin: QuerySpec = { ...PAGED, source: 'pharo' };
    const res = await runQueries(run, [['p', fromPlugin]], { rowLimit: 20 });
    expect(run).toHaveBeenLastCalledWith(fromPlugin);
    expect(res.rows).toEqual({});
  });

  it('loads again as many rows as were there', async () => {
    const res = await runQueries(run, [['paged', PAGED]], { rowLimit: 20 }, { paged: 300 });
    expect(res.rows.paged.loaded).toBe(300);
  });

  it('keeps the other results when one query fails, and reports the error', async () => {
    const failing = vi.fn<Runner>(async (q) => (q.query.includes('broken') ? { error: new Error('broken') } : run(q)));
    const res = await runQueries(failing, [['ok', PAGED], ['ko', { query: '{ broken }' }]], {});
    expect(res.error?.message).toBe('broken');
    expect(res.rows.ok.loaded).toBe(10);
  });
});
