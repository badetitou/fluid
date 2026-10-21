import { describe, expect, it } from 'vitest';
import type { ViewSpec, Widget } from '@fluid/shared';
import {
  columnEntries,
  injectItemId,
  newViewDraft,
  newViewId,
  preserveLayouts,
  resolveActiveKey,
  savedViewDraft,
} from './model';
import type { ViewEntry } from './useViews';

const spec = (id: string, extra: Partial<ViewSpec> = {}): ViewSpec => ({
  version: 1,
  id,
  concept: 'Account',
  title: id,
  queries: {},
  widgets: [],
  ...extra,
});

const widget = (id: string, layout?: Widget['layout']): Widget => ({
  id,
  type: 'table',
  data: { query: 'q' },
  layout,
});

const entry = (key: string, extra: Partial<ViewSpec> = {}): ViewEntry => ({
  key,
  title: key,
  source: 'curated',
  spec: spec(key, extra),
});

describe('newViewId / newViewDraft', () => {
  it('derives a lowercase id from the concept', () => {
    expect(newViewId('Account', 35)).toBe('account-view-z');
  });

  it('starts an empty view in the requested scope', () => {
    const draft = newViewDraft('Account', undefined, 'detail');
    expect(draft.spec).toMatchObject({ concept: 'Account', scope: 'detail', widgets: [] });
    expect(draft.isDefault).toBe(false);
  });

  it('clones a source view with a new id', () => {
    const draft = newViewDraft('Account', spec('src', { widgets: [widget('w')] }), 'list');
    expect(draft.spec.id).not.toBe('src');
    expect(draft.spec.widgets).toHaveLength(1);
    expect(draft.spec.scope).toBe('list');
  });
});

describe('savedViewDraft', () => {
  it('is null for unsaved entries', () => {
    expect(savedViewDraft(entry('a'))).toBeNull();
  });

  it('carries the saved id for editing', () => {
    const saved = { id: 'db1', concept: 'Account', title: 'T', spec: spec('a'), isDefault: true, createdAt: '', updatedAt: '' };
    expect(savedViewDraft({ ...entry('a'), source: 'saved', saved })).toEqual({
      title: 'T',
      spec: saved.spec,
      isDefault: true,
      editingId: 'db1',
    });
  });
});

describe('columnEntries', () => {
  const list = entry('list', { scope: 'list' });
  const detail = entry('detail', { scope: 'detail' });

  it('keeps only perspectives of the column kind', () => {
    expect(columnEntries([list, detail], 'list', undefined, null)).toEqual([list]);
  });

  it('puts the auto detail perspective first', () => {
    const auto = entry('auto');
    expect(columnEntries([list, detail], 'detail', undefined, auto).map((e) => e.key)).toEqual(['auto', 'detail']);
  });
});

describe('resolveActiveKey', () => {
  const entries = [entry('a'), entry('b'), entry('c')];

  it('honours a listed pick', () => {
    expect(resolveActiveKey(entries, 'c', 'b')).toBe('c');
  });

  it('falls back to the preferred default, then the first entry', () => {
    expect(resolveActiveKey(entries, 'gone', 'b')).toBe('b');
    expect(resolveActiveKey(entries, undefined, 'gone')).toBe('a');
    expect(resolveActiveKey([], undefined, undefined)).toBeUndefined();
  });
});

describe('injectItemId', () => {
  const byId = spec('d', { queries: { account: { query: 'q', variables: { other: 1 } } } });

  it('sets the id on the by-id query', () => {
    expect(injectItemId(byId, 'account', '42').queries.account.variables).toEqual({ other: 1, id: '42' });
  });

  it('leaves views that do not read the by-id query untouched', () => {
    expect(injectItemId(byId, 'customer', '42')).toBe(byId);
    expect(injectItemId(byId, 'account', undefined)).toBe(byId);
  });
});

describe('preserveLayouts', () => {
  const w = widget;

  it('restores the arrangement of kept widgets only', () => {
    const previous = [w('a', { x: 1, y: 2, w: 3, h: 4 }), w('b', { x: 0, y: 0, w: 1, h: 1 })];
    const next = preserveLayouts([w('a'), w('b', { x: 5, y: 5, w: 1, h: 1 }), w('c')], previous);
    expect(next.map((x) => x.layout)).toEqual([
      { x: 1, y: 2, w: 3, h: 4 },
      { x: 5, y: 5, w: 1, h: 1 },
      undefined,
    ]);
  });
});
