import { describe, expect, it, vi } from 'vitest';
import { parseViewSpec } from '@fluid/shared';
import { SPEC } from './fixtures';
import { normalizeQuery, varsKey, ViewerData } from './viewerData';

const spec = parseViewSpec(SPEC);
const QUERY = spec.queries.list.query;
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));
const result = (n: number) => ({ data: { characters: rows(n) } });
const initial = { list: result(3) };

function make(take: number | undefined = 100) {
  const run = vi.fn(async ({ take: t }: { take?: number }) => ({ list: result(t ?? 100) }));
  return { run, data: new ViewerData(spec, initial, take, run) };
}

describe('ViewerData', () => {
  it('matches a query text whatever its formatting', () => {
    expect(normalizeQuery('query($take:Int){characters(take:$take){id name}}')).toBe(normalizeQuery(QUERY));
    expect(varsKey({ take: 5, b: 1, a: 2 })).toBe(varsKey({ a: 2, b: 1 }));
  });

  it('answers the first request from the stored results, without a call', async () => {
    const { data, run } = make();
    expect(await data.answer(QUERY, { take: 100 })).toBe(initial.list);
    expect(run).not.toHaveBeenCalled();
  });

  it('cuts a stored answer to a smaller take, without a call', async () => {
    const stored = { list: result(100) };
    const run = vi.fn();
    const data = new ViewerData(spec, stored, 100, run);
    const r = await data.answer(QUERY, { take: 20 });
    expect((r.data as { characters: unknown[] }).characters).toHaveLength(20);
    expect(run).not.toHaveBeenCalled();
  });

  it('counts the server default as the stored take when the first run did not say', async () => {
    const { data, run } = make(undefined);
    await data.answer(QUERY, { take: 100 });
    expect(run).not.toHaveBeenCalled();
    await data.answer(QUERY, { take: 101 });
    expect(run).toHaveBeenCalledWith({ take: 101 });
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
    expect((more.data as { characters: unknown[] }).characters).toHaveLength(150);
    await data.answer(QUERY, { take: 150 });
    await data.answer(QUERY, { take: 120 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refetches when the variables other than take change', async () => {
    const { data, run } = make();
    await data.answer(QUERY, { take: 20, name: 'rick' });
    expect(run).toHaveBeenCalledWith({ take: 20, variables: { name: 'rick' } });
  });

  it('merges identical refetches in flight into one run', async () => {
    const { data, run } = make();
    const [a, b] = await Promise.all([data.answer(QUERY, { take: 200 }), data.answer(QUERY, { take: 200 })]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('lets a failed refetch reject, then tries again', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('too large')).mockResolvedValueOnce({ list: result(9) });
    const data = new ViewerData(spec, initial, 100, run);
    await expect(data.answer(QUERY, { take: 500 })).rejects.toThrow('too large');
    await expect(data.answer(QUERY, { take: 500 })).resolves.toMatchObject({ data: expect.anything() });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('answers an error result when the server does not answer the query', async () => {
    const data = new ViewerData(spec, initial, 100, vi.fn(async () => ({})));
    const r = await data.answer(QUERY, { take: 500 });
    expect(r.errors?.[0]).toMatchObject({ message: expect.stringContaining('did not answer') });
  });
});

describe('ViewerData with several queries', () => {
  const two = parseViewSpec({
    ...SPEC,
    queries: {
      one: { query: 'query($take: Int, $id: ID){ c(take: $take, id: $id){ id } }', variables: { id: 'a' } },
      two: { query: 'query($take: Int, $id: ID){ c(take: $take, id: $id){ id } }', variables: { id: 'b' } },
      other: { query: 'query($take: Int){ d(take: $take){ id } }', variables: {} },
    },
    widgets: [],
  });
  const stored = {
    one: { data: { c: [{ id: 'one' }] } },
    two: { data: { c: [{ id: 'two' }] } },
    other: { data: { d: [{ id: 'd' }] } },
  };

  it('tells two queries with the same text apart by their variables', async () => {
    const data = new ViewerData(two, stored, 100, vi.fn());
    const text = two.queries.one.query;
    expect(await data.answer(text, { take: 100, id: 'a' })).toBe(stored.one);
    expect(await data.answer(text, { take: 100, id: 'b' })).toBe(stored.two);
  });

  it('keeps every answer of one run for all the queries (no run per query)', async () => {
    const run = vi.fn(async () => ({
      one: { data: { c: [{ id: 'one' }, { id: 'x' }] } },
      two: { data: { c: [{ id: 'two' }, { id: 'y' }] } },
      other: { data: { d: [{ id: 'd' }, { id: 'z' }] } },
    }));
    const data = new ViewerData(two, stored, 100, run);
    await data.answer(two.queries.other.query, { take: 300 });
    await data.answer(two.queries.one.query, { take: 300, id: 'a' });
    await data.answer(two.queries.two.query, { take: 300, id: 'b' });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
