import { describe, expect, it } from 'vitest';
import {
  objectViewsResponseSchema,
  openViewsDiscoverySchema,
  openViewsErrorSchema,
  viewActionResultSchema,
  viewEvaluationSchema,
  viewItemsQuerySchema,
  viewItemsResponseSchema,
  viewResponseSchema,
} from './protocol';

describe('Open Views protocol documents', () => {
  it('parses a discovery document and defaults the capabilities', () => {
    const parsed = openViewsDiscoverySchema.parse({ protocol: 'fluid-views', version: 1, name: 'Moose' });
    expect(parsed.capabilities).toEqual({});
    const full = { protocol: 'fluid-views', version: 1, name: 'Moose', capabilities: { actions: true, evaluate: true } };
    expect(openViewsDiscoverySchema.parse(full)).toEqual(full);
  });

  it.each([
    ['another protocol', { protocol: 'phlow', version: 1, name: 'x' }],
    ['another version', { protocol: 'fluid-views', version: 2, name: 'x' }],
    ['no name', { protocol: 'fluid-views', version: 1 }],
  ])('rejects a discovery document with %s', (_name, doc) => {
    expect(openViewsDiscoverySchema.safeParse(doc).success).toBe(false);
  });

  it('parses the views of an object', () => {
    const doc = {
      object: { id: '42', type: 'FamixJavaClass', label: 'Collection' },
      views: [
        { key: 'methods', title: 'Methods', priority: 10 },
        { key: 'source', title: 'Source', priority: 5 },
      ],
    };
    expect(objectViewsResponseSchema.parse(doc)).toEqual(doc);
    expect(objectViewsResponseSchema.safeParse({ object: { id: '' }, views: [] }).success).toBe(false);
  });

  it('parses a view with actions', () => {
    const doc = {
      key: 'methods',
      title: 'Methods',
      priority: 10,
      view: { kind: 'list', items: [], lazy: true },
      actions: [
        { id: 'refresh', label: 'Refresh', icon: 'reload' },
        { id: 'delete', label: 'Delete', confirm: 'Delete this class?' },
      ],
    };
    expect(viewResponseSchema.parse(doc)).toEqual(doc);
  });

  it('parses a view whose node kind is unknown as unsupported', () => {
    const doc = { key: 'k', title: 't', priority: 1, view: { kind: 'map', points: [] } };
    expect(viewResponseSchema.parse(doc).view).toEqual({ kind: 'unsupported', type: 'map' });
  });

  it('rejects a view without its node or with a bad action', () => {
    expect(viewResponseSchema.safeParse({ key: 'k', title: 't', priority: 1 }).success).toBe(false);
    const badAction = { key: 'k', title: 't', priority: 1, view: { kind: 'label', text: '' }, actions: [{ label: 'x' }] };
    expect(viewResponseSchema.safeParse(badAction).success).toBe(false);
  });

  it('parses the items query from URL strings', () => {
    expect(viewItemsQuerySchema.parse({ path: '0.3.1', offset: '20', limit: '50' })).toEqual({
      path: '0.3.1',
      offset: 20,
      limit: 50,
    });
    expect(viewItemsQuerySchema.parse({ path: '0' })).toEqual({ path: '0', offset: 0 });
    expect(viewItemsQuerySchema.safeParse({ path: '' }).success).toBe(false);
    expect(viewItemsQuerySchema.safeParse({ path: '0..1' }).success).toBe(false);
    expect(viewItemsQuerySchema.safeParse({ path: '0', limit: '0' }).success).toBe(false);
  });

  it('parses items, action results, evaluations and errors', () => {
    const items = { items: [{ cells: [{ text: 'a' }], hasChildren: true }], total: 300 };
    expect(viewItemsResponseSchema.parse(items)).toEqual(items);
    const result = { refresh: true, ref: { id: '7' }, message: 'Done' };
    expect(viewActionResultSchema.parse(result)).toEqual(result);
    const evaluation = { display: 'a Set(3)', items: [{ text: '1' }], truncated: true };
    expect(viewEvaluationSchema.parse(evaluation)).toEqual(evaluation);
    expect(openViewsErrorSchema.parse({ error: 'No such view', code: 'view-not-found' })).toBeTruthy();
    expect(openViewsErrorSchema.safeParse({ message: 'oops' }).success).toBe(false);
    expect(openViewsErrorSchema.safeParse({ error: 'No code' }).success).toBe(false);
  });
});
