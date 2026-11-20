import { describe, expect, it } from 'vitest';
import type { ProxyResult } from '../sources/proxy';
import { authRequiredResult } from '../sources/oauth/model';
import { createViewRunService } from './run-service';

const view = (queries: Record<string, object>) => ({ id: 'v', concept: 'C', title: 'T', queries, widgets: [] });
const reader = (spec: unknown) => ({ getSpec: async () => spec });
const ok = (data: unknown): ProxyResult => ({ status: 200, body: { data } });

function fakeSources(answer: (query: string, n: number) => ProxyResult | Promise<ProxyResult> | null) {
  const calls: { query: string; variables?: unknown }[] = [];
  return {
    calls,
    get: async () => ({}) as never,
    runGraphql: async (_id: string, b: { query: string; variables?: unknown }) => {
      calls.push(b);
      return answer(b.query, calls.length);
    },
  };
}

describe('view run service', () => {
  it('returns an error entry for an unparsable stored query without calling the source; others run', async () => {
    const src = fakeSources(() => ok({ a: 1 }));
    const svc = createViewRunService(reader(view({ bad: { query: 'not graphql {' }, good: { query: '{ a }' } })), src);
    const out = await svc.run('v', { sourceId: 's' });
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect(out.results.good).toEqual({ data: { a: 1 } });
    expect(out.results.bad.errors?.[0]).toMatchObject({ message: expect.stringContaining('Invalid query') });
    expect(src.calls).toHaveLength(1);
  });

  it('refuses mutations, subscriptions and several operations without calling the source', async () => {
    const src = fakeSources(() => ok({}));
    const svc = createViewRunService(
      reader(view({ m: { query: 'mutation { x }' }, s: { query: 'subscription { x }' }, two: { query: 'query A { a } query B { b }' } })),
      src,
    );
    const out = await svc.run('v', { sourceId: 's' });
    if (out.kind !== 'ok') throw new Error(out.kind);
    for (const name of ['m', 's', 'two']) {
      expect(out.results[name].errors).toEqual([{ message: 'Only a single query operation can run' }]);
    }
    expect(src.calls).toHaveLength(0);
  });

  it('refuses a view with more runnable queries than the cap, counting plugin queries out', async () => {
    const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`q${i}`, { query: '{ a }' }]));
    const src = fakeSources(() => ok({}));
    const svc = createViewRunService(reader(view(many)), src);
    expect(await svc.run('v', { sourceId: 's' })).toEqual({ kind: 'too-many-queries', max: 20 });
    expect(src.calls).toHaveLength(0);
    const plugins = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`p${i}`, { query: 'x', source: 'open-views' }]));
    const out = await createViewRunService(reader(view(plugins)), src).run('v', { sourceId: 's' });
    expect(out).toMatchObject({ kind: 'ok', skipped: expect.any(Array) });
  });

  it('runs with bounded concurrency', async () => {
    const queries = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`q${i}`, { query: '{ a }' }]));
    let active = 0;
    let peak = 0;
    const src = fakeSources(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return ok({});
    });
    await createViewRunService(reader(view(queries)), src, { concurrency: 3 }).run('v', { sourceId: 's' });
    expect(src.calls).toHaveLength(10);
    expect(peak).toBe(3);
  });

  it('short-circuits on the first FLUID_AUTH_REQUIRED and returns the proxy answer when all failed', async () => {
    const queries = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`q${i}`, { query: '{ a }' }]));
    const src = fakeSources(() => authRequiredResult('signin'));
    const out = await createViewRunService(reader(view(queries)), src, { concurrency: 1 }).run('v', { sourceId: 's' });
    expect(out).toMatchObject({ kind: 'auth-required', status: 401 });
    expect(src.calls).toHaveLength(1);
  });

  it('answers 200 with the auth error inside when only one query needs a sign-in', async () => {
    const src = fakeSources((q) => (q.includes('secret') ? authRequiredResult('insufficient_scope', 'w') : ok({ a: 1 })));
    const svc = createViewRunService(reader(view({ open: { query: '{ a }' }, locked: { query: '{ secret }' } })), src, { concurrency: 1 });
    const out = await svc.run('v', { sourceId: 's' });
    if (out.kind !== 'ok') throw new Error(out.kind);
    expect(out.results.open).toEqual({ data: { a: 1 } });
    expect(out.results.locked.errors?.[0]).toMatchObject({ extensions: { code: 'FLUID_AUTH_REQUIRED' } });
  });

  it('stops starting queries after the deadline', async () => {
    const queries = Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`q${i}`, { query: '{ a }' }]));
    let t = 0;
    const src = fakeSources(() => {
      t += 100;
      return ok({});
    });
    const svc = createViewRunService(reader(view(queries)), src, { concurrency: 1, deadlineMs: 150 }, () => t);
    const out = await svc.run('v', { sourceId: 's' });
    if (out.kind !== 'ok') throw new Error(out.kind);
    expect(src.calls).toHaveLength(2);
    expect(out.results.q2.errors).toEqual([{ message: 'Run time limit reached' }]);
  });

  it('handles a query named __proto__ and passes upstream GraphQL errors through', async () => {
    const src = fakeSources(() => ({ status: 200, body: { data: null, errors: [{ message: 'boom' }] } }));
    const spec = JSON.parse('{"id":"v","concept":"C","title":"T","widgets":[],"queries":{"__proto__":{"query":"{ a }"}}}');
    const out = await createViewRunService(reader(spec), src).run('v', { sourceId: 's' });
    if (out.kind !== 'ok') throw new Error(out.kind);
    // The schema may drop the key; either way the results have no prototype to pollute.
    expect(Object.getPrototypeOf(out.results)).toBeNull();
    for (const r of Object.values(out.results)) expect(r).toEqual({ data: null, errors: [{ message: 'boom' }] });
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('answers ok with only skipped names when every query targets a plugin source', async () => {
    const src = fakeSources(() => ok({}));
    const svc = createViewRunService(reader(view({ p: { query: 'x', source: 'open-views' } })), src);
    expect(await svc.run('v', { sourceId: 's' })).toEqual({ kind: 'ok', results: {}, skipped: ['p'] });
  });
});
