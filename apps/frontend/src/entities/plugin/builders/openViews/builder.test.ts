import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Concept } from '../../../../graphql/introspection';
import type { ViewBuilderContext } from '../../viewBuilder';
import { specFluidViewBuilder } from '../specFluid';
import { createOpenViewsBuilder, evaluateOn, forgetProviders } from '.';

const A = 'http://a.test';
const B = 'http://b.test';
const SF = 'http://pharo.test/spec-fluid';

/** A fake network: JSON bodies by URL; anything else is a network failure. */
type Route = { status?: number; body: unknown };
let routes: Record<string, Route>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const route = routes[`${init?.method ?? 'GET'} ${url}`];
  if (!route) throw new TypeError('Failed to fetch');
  return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
});

const discovery = (name: string, capabilities = {}) => ({ body: { protocol: 'fluid-views', version: 1, name, capabilities } });
const context = (settings: Record<string, string>): ViewBuilderContext => ({
  concept: { name: 'Class' } as Concept,
  columnKind: 'detail',
  itemId: '7',
  conceptByName: new Map(),
  queriesByType: new Map(),
  writable: false,
  settings,
});
const builder = createOpenViewsBuilder({ id: 'ov', label: 'OV', endpoints: (s) => (s.endpoints ? s.endpoints.split(' ') : []) });
const signal = new AbortController().signal;

beforeEach(() => {
  routes = {};
  forgetProviders();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Open Views builder', () => {
  it('merges the views of every endpoint by priority; an unreachable one proposes nothing', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A');
    routes[`GET ${A}/objects/7/views`] = { body: { object: { id: '7' }, views: [{ key: 'x', title: 'X', priority: 9 }] } };
    routes[`GET ${B}/.well-known/fluid-views`] = discovery('B');
    routes[`GET ${B}/objects/7/views`] = { body: { object: { id: '7' }, views: [{ key: 'y', title: 'Y', priority: 1 }] } };
    const perspectives = await builder.fetchPerspectives!(context({ endpoints: `${A} ${B} http://down.test` }), signal);
    expect(perspectives.map((p) => p.key)).toEqual([`ov:${B}:y`, `ov:${A}:x`]);
    expect(await builder.fetchPerspectives!({ ...context({ endpoints: A }), columnKind: 'list' }, signal)).toEqual([]);
  });

  it('answers view and items queries, unknown kinds shown as unsupported', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A');
    routes[`GET ${A}/objects/7/views/x`] = { body: { key: 'x', title: 'X', priority: 1, view: { kind: 'hologram' } } };
    routes[`GET ${A}/objects/7/views/x/items?path=0.1&offset=10`] = { body: { items: [{ cells: [{ text: 'a' }] }], total: 11 } };
    const source = builder.dataSource!({ endpoints: A });
    expect(await source.run('view', { endpoint: A, id: '7', view: 'x' })).toMatchObject({ view: { kind: 'unsupported', type: 'hologram' } });
    expect(await source.run('items', { endpoint: A, id: '7', view: 'x', path: '0.1', offset: 10 })).toEqual({
      items: [{ cells: [{ text: 'a' }] }],
      total: 11,
    });
    await expect(source.run('tab', {})).rejects.toThrow(/not "tab"/);
  });

  it('reads an old Spec-Fluid server through the legacy routes', async () => {
    routes[`GET ${SF}/.well-known/fluid-views`] = { status: 404, body: { error: 'not found' } };
    routes[`GET ${SF}/entities/7/tabs`] = { body: { entity: { id: '7' }, tabs: [{ key: 'fame:', title: 'Fame', order: 2 }] } };
    routes[`GET ${SF}/entities/7/tabs/fame%3A`] = {
      body: { key: 'fame:', title: 'Fame', order: 2, root: { kind: 'table', columns: [{ title: 'N' }], rows: [{ cells: [{ text: 'a' }] }] } },
    };
    routes[`POST ${SF}/entities/7/evaluate`] = { body: { display: '42' } };
    const settings = { endpoint: SF };
    const [perspective] = await specFluidViewBuilder.fetchPerspectives!(context(settings), signal);
    expect(perspective).toMatchObject({ key: `spec-fluid:${SF}:fame:`, title: 'Fame' });
    const view = await specFluidViewBuilder.dataSource!(settings).run('view', perspective.spec.queries.view.variables ?? {});
    expect(view).toMatchObject({ view: { kind: 'columnedList', items: [{ cells: [{ text: 'a' }] }] } });
    expect(await evaluateOn(SF, '7', 'self')).toEqual({ display: '42' });
  });

  it('evaluates through the evaluate capability only', async () => {
    routes[`GET ${A}/.well-known/fluid-views`] = discovery('A', { evaluate: true });
    routes[`POST ${A}/objects/7/evaluate`] = { body: { display: 'ok' } };
    routes[`GET ${B}/.well-known/fluid-views`] = discovery('B');
    expect(await evaluateOn(A, '7', 'self')).toEqual({ display: 'ok' });
    await expect(evaluateOn(B, '7', 'self')).rejects.toThrow(/does not evaluate/);
  });
});
