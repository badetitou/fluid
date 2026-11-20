import { describe, expect, it } from 'vitest';
import { viewResponseSchema, viewSpecSchema } from '@fluid/shared';
import type { Concept } from '../../../../graphql/introspection';
import {
  itemsSearch,
  mergeByPriority,
  normalizeUnknownKinds,
  normalizeViewResponse,
  openViewsUrl,
  parseEndpoints,
  configuredEndpoint,
  queryVariables,
  resolveQuery,
  viewPerspective,
} from './model';

const concept = { name: 'Method' } as Concept;
const A = 'http://a.test/views';
const B = 'http://b.test';

describe('Open Views builder model', () => {
  it('reads the endpoints of a setting', () => {
    expect(parseEndpoints(` ${A}/ \n${B}, ftp://c.test ${A} not-a-url`)).toEqual([A, B]);
    expect(parseEndpoints(undefined)).toEqual([]);
  });

  it('encodes ids and keys in URLs, and the items query', () => {
    expect(openViewsUrl(`${A}/`, 'objects', '1:42', 'views', 'fame:')).toBe(`${A}/objects/1%3A42/views/fame%3A`);
    expect(itemsSearch({ path: '1.3', offset: 20, limit: 10 })).toBe('?path=1.3&offset=20&limit=10');
    expect(itemsSearch({ path: '0' })).toBe('?path=0');
  });

  it('shows unknown node kinds as unsupported, at any depth', () => {
    const view = {
      kind: 'composite',
      direction: 'row',
      children: [
        { kind: 'label', text: 'a' },
        { kind: 'tabs', tabs: [{ title: 'x', node: { kind: 'chart3d', points: [] } }] },
        { kind: 'gauge' },
      ],
    };
    const body = normalizeViewResponse({ key: 'k', title: 'K', priority: 1, view });
    expect(viewResponseSchema.safeParse(body).success).toBe(true);
    expect(normalizeUnknownKinds(view)).toMatchObject({
      children: [
        { kind: 'label' },
        { tabs: [{ node: { kind: 'unsupported', type: 'chart3d' } }] },
        { kind: 'unsupported', type: 'gauge' },
      ],
    });
    expect(normalizeUnknownKinds('x')).toBe('x');
  });

  it('merges the views of every endpoint by priority, keeping the order of ties', () => {
    const merged = mergeByPriority([
      { endpoint: A, views: [{ key: 'a1', title: '', priority: 10 }, { key: 'a2', title: '', priority: 5 }] },
      { endpoint: B, views: [{ key: 'b1', title: '', priority: 5 }, { key: 'b2', title: '', priority: 1 }] },
    ]);
    expect(merged.map(({ endpoint, view }) => `${endpoint === A ? 'A' : 'B'}:${view.key}`)).toEqual(['B:b2', 'A:a2', 'B:b1', 'A:a1']);
  });

  it('makes a valid detail view reading the view from the data source', () => {
    const p = viewPerspective('open-views', concept, '1:42', A, { key: 'fame:', title: 'Fame', priority: 3 });
    expect(p).toMatchObject({ key: `open-views:${A}:fame:`, title: 'Fame', origin: 'remote' });
    const other = viewPerspective('open-views', concept, '1:42', B, { key: 'fame:', title: 'Fame', priority: 3 });
    expect(other.spec.id).not.toBe(p.spec.id);
    expect(viewSpecSchema.safeParse(p.spec).error?.issues ?? []).toEqual([]);
    expect(p.spec.scope).toBe('detail');
    expect(p.spec.queries.view).toEqual({
      source: 'open-views',
      query: 'view',
      variables: { endpoint: A, id: '1:42', view: 'fame:' },
    });
    expect(p.spec.widgets[0]).toMatchObject({ type: 'specPresenter', data: { query: 'view' } });
  });

  it('checks the variables of a query', () => {
    expect(queryVariables('view', { endpoint: A, id: '1', view: 'k' })).toEqual({ endpoint: A, id: '1', view: 'k' });
    expect(queryVariables('view', { id: '1', view: 'k' })).toEqual({ id: '1', view: 'k' });
    expect(queryVariables('items', { id: '1', view: 'k', path: '0.2', offset: 5 })).toMatchObject({ path: '0.2', offset: 5 });
    expect(() => queryVariables('view', { id: 3 })).toThrow(/needs "id" and "view"/);
    expect(() => queryVariables('items', { id: '1', view: 'k', path: 'x' })).toThrow(/"path"/);
    expect(queryVariables('views', { id: '1', view: 'ignored' })).toEqual({ id: '1' });
    expect(() => queryVariables('action', { id: '1', view: 'k' })).toThrow(/"action"/);
  });

  it('keeps a named endpoint only when it is a configured one', () => {
    expect(configuredEndpoint(`${A}/`, [A, B])).toBe(A);
    expect(configuredEndpoint('http://evil.test', [A])).toBeUndefined();
    expect(configuredEndpoint(undefined, [A])).toBeUndefined();
  });

  it('reads the tab query of views saved before Open Views as a view query', () => {
    expect(resolveQuery('tab', { id: '1', tab: 'fame:' })).toEqual({ query: 'view', variables: { id: '1', view: 'fame:' } });
    const items = { id: '1', view: 'k', path: '0' };
    expect(resolveQuery('items', items)).toEqual({ query: 'items', variables: items });
  });
});
