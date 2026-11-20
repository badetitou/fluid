import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Concept } from '../../../../graphql/introspection';
import type { ViewBuilderContext } from '../../viewBuilder';
import { REQUEST_TIMEOUT_MS } from './api';
import { forgetProviders, openViewsBuilder } from '.';

const A = 'http://a.test';
const B = 'http://b.test';

/** A fake network: JSON bodies by method and URL; anything else is a network failure. */
type Route = { status?: number; body: unknown };
let routes: Record<string, Route>;
const network = async (url: string, init?: RequestInit) => {
  const route = routes[`${init?.method ?? 'GET'} ${url}`];
  if (!route) throw new TypeError('Failed to fetch');
  return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
};
const fetchMock = vi.fn(network);

const discovery = (name: string, capabilities = {}) => ({ body: { protocol: 'fluid-views', version: 1, name, capabilities } });
const views = (id: string, ...keys: [string, number][]) => ({
  body: { object: { id }, views: keys.map(([key, priority]) => ({ key, title: key.toUpperCase(), priority })) },
});
const context = (endpoints: string): ViewBuilderContext => ({
  concept: { name: 'Class' } as Concept,
  columnKind: 'detail',
  itemId: '7',
  conceptByName: new Map(),
  queriesByType: new Map(),
  writable: false,
  settings: { endpoints },
});
const signal = new AbortController().signal;
const source = (endpoints: string) => openViewsBuilder.dataSource!({ endpoints });

beforeEach(() => {
  routes = {};
  forgetProviders();
  fetchMock.mockImplementation(network);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Open Views builder', () => {
  it('merges the views of every endpoint by priority; an unreachable one proposes nothing', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A');
    routes[`GET ${A}/objects/7/views`] = views('7', ['x', 9]);
    routes[`GET ${B}/.well-known/fluid-views`] = discovery('B');
    routes[`GET ${B}/objects/7/views`] = views('7', ['y', 1]);
    const perspectives = await openViewsBuilder.fetchPerspectives!(context(`${A}\n${B}, http://down.test`), signal);
    expect(perspectives.map((p) => p.key)).toEqual([`open-views:${B}:y`, `open-views:${A}:x`]);
    expect(await openViewsBuilder.fetchPerspectives!({ ...context(A), columnKind: 'list' }, signal)).toEqual([]);
  });

  it('answers view and items queries, unknown kinds shown as unsupported', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A');
    routes[`GET ${A}/objects/7/views/x`] = { body: { key: 'x', title: 'X', priority: 1, view: { kind: 'hologram' } } };
    routes[`GET ${A}/objects/7/views/x/items?path=0.1&offset=10`] = { body: { items: [{ cells: [{ text: 'a' }] }], total: 11 } };
    expect(await source(A).run('view', { endpoint: A, id: '7', view: 'x' })).toMatchObject({ view: { kind: 'unsupported', type: 'hologram' } });
    expect(await source(A).run('items', { endpoint: A, id: '7', view: 'x', path: '0.1', offset: 10 })).toEqual({
      items: [{ cells: [{ text: 'a' }] }],
      total: 11,
    });
    await expect(source(A).run('nope', {})).rejects.toThrow(/not "nope"/);
  });

  it('answers views and action queries, actions only with the capability and as a bare POST', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A', { actions: true });
    routes[`GET ${A}/objects/8/views`] = views('8', ['z', 0]);
    routes[`POST ${A}/objects/7/views/x/actions/refresh`] = { body: { refresh: true } };
    routes[`GET ${B}/.well-known/fluid-views`] = discovery('B');
    expect(await source(A).run('views', { endpoint: A, id: '8' })).toMatchObject({ views: [{ key: 'z' }] });
    expect(await source(A).run('action', { endpoint: A, id: '7', view: 'x', action: 'refresh' })).toEqual({ refresh: true });
    expect(fetchMock).toHaveBeenLastCalledWith(`${A}/objects/7/views/x/actions/refresh`, expect.objectContaining({ method: 'POST' }));
    expect(fetchMock.mock.lastCall?.[1]).not.toHaveProperty('body');
    await expect(source(B).run('action', { endpoint: B, id: '7', view: 'x', action: 'refresh' })).rejects.toThrow(/no "actions" capability/);
  });

  it('reads a view on the first configured endpoint serving the object, when its endpoint is not configured', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A');
    routes[`GET ${A}/objects/7/views`] = { status: 404, body: { error: 'unknown', code: 'object-not-found' } };
    routes[`GET ${B}/.well-known/fluid-views`] = discovery('B');
    routes[`GET ${B}/objects/7/views`] = views('7', ['fame:', 2]);
    routes[`GET ${B}/objects/7/views/fame%3A`] = {
      body: { key: 'fame:', title: 'Fame', priority: 2, view: { kind: 'label', text: 'Fame' } },
    };
    const both = source(`${A} ${B}`);
    expect(await both.run('view', { id: '7', view: 'fame:' })).toMatchObject({ key: 'fame:', view: { kind: 'label' } });
    expect(await both.run('view', { endpoint: 'http://elsewhere.test', id: '7', view: 'fame:' })).toMatchObject({ key: 'fame:' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('http://elsewhere.test'))).toBe(false);
    await expect(both.run('view', { id: '9', view: 'k' })).rejects.toThrow(/No Open Views endpoint serves the object 9/);
  });

  it('gives up on an endpoint that never answers, without holding back the others', async () => {
    vi.useFakeTimers();
    try {
      routes[`GET ${A}/.well-known/fluid-views`] = discovery('A');
      routes[`GET ${A}/objects/7/views`] = views('7', ['x', 1]);
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.startsWith(B)) {
          return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
        }
        return network(url, init);
      });
      const pending = openViewsBuilder.fetchPerspectives!(context(`${A} ${B}`), signal);
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      expect((await pending).map((p) => p.key)).toEqual([`open-views:${A}:x`]);
    } finally {
      vi.useRealTimers();
    }
  });
});
