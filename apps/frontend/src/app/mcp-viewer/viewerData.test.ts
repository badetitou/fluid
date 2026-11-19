import { describe, expect, it, vi } from 'vitest';
import { parseViewSpec } from '@fluid/shared';
import { SPEC } from './fixtures';
import { normalizeQuery, varsKey, ViewerData } from './viewerData';

const spec = parseViewSpec(SPEC);
const QUERY = spec.queries.list.query;
const initial = { list: { data: { characters: [{ id: '1' }] } } };

function make(take: number | undefined = 100) {
  const run = vi.fn(async () => ({ list: { data: { characters: [{ id: '1' }, { id: '2' }] } } }));
  return { run, data: new ViewerData(spec, initial, take, run) };
}

describe('ViewerData', () => {
  it('matches a query text whatever its formatting', () => {
    expect(normalizeQuery('query($take:Int){characters(take:$take){id name}}')).toBe(normalizeQuery(QUERY));
    expect(varsKey({ take: 5, b: 1, a: 2 })).toBe(varsKey({ a: 2, b: 1 }));
  });

  it('answers a known query from the stored results, without a call', async () => {
    const { data, run } = make();
    expect(await data.answer(QUERY, { take: 20 })).toBe(initial.list);
    expect(run).not.toHaveBeenCalled();
  });

  it('answers an unknown query with an error result', async () => {
    const { data, run } = make();
    const r = await data.answer('query { other }', {});
    expect(r.errors?.[0]).toMatchObject({ message: expect.stringContaining('not part of the view') });
    expect(run).not.toHaveBeenCalled();
  });

  it('passes the errors of a stored result through', async () => {
    const failing = { list: { errors: [{ message: 'boom' }] } };
    const data = new ViewerData(spec, failing, 100, vi.fn());
    expect(await data.answer(QUERY, { take: 20 })).toEqual(failing.list);
  });

  it('refetches with run_queries for more rows, then serves them from the cache', async () => {
    const { data, run } = make(100);
    const more = await data.answer(QUERY, { take: 150 });
    expect(run).toHaveBeenCalledWith({ take: 150 });
    expect(more.data).toEqual({ characters: [{ id: '1' }, { id: '2' }] });
    await data.answer(QUERY, { take: 150 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refetches when the variables other than take change', async () => {
    const { data, run } = make();
    await data.answer(QUERY, { take: 20, name: 'rick' });
    expect(run).toHaveBeenCalledWith({ take: 20, variables: { name: 'rick' } });
  });

  it('answers an error result when the server does not answer the query', async () => {
    const data = new ViewerData(spec, initial, 100, vi.fn(async () => ({})));
    const r = await data.answer(QUERY, { take: 500 });
    expect(r.errors?.[0]).toMatchObject({ message: expect.stringContaining('did not answer') });
  });

  it('lets a failed refetch reject', async () => {
    const data = new ViewerData(spec, initial, 100, vi.fn(async () => Promise.reject(new Error('too large'))));
    await expect(data.answer(QUERY, { take: 500 })).rejects.toThrow('too large');
  });
});
