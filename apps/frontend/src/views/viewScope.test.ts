import { describe, it, expect } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import { getViewScope, isViewForColumn, withScope } from './viewScope';

function makeSpec(overrides: Partial<ViewSpec> = {}): ViewSpec {
  return {
    version: 1,
    id: 'v1',
    concept: 'Account',
    title: 'A view',
    queries: {},
    widgets: [],
    ...overrides,
  };
}

describe('getViewScope', () => {
  it('respects an explicit scope', () => {
    expect(getViewScope(makeSpec({ scope: 'detail' }))).toBe('detail');
    expect(getViewScope(makeSpec({ scope: 'list' }))).toBe('list');
  });

  it('falls back to the by-id heuristic for legacy views without a scope', () => {
    const detailish = makeSpec({
      queries: { accountById: { query: 'query($id: ID!){ accountById(id:$id){ id } }' } },
    });
    expect(getViewScope(detailish, 'accountById')).toBe('detail');

    const listish = makeSpec({
      queries: { rows: { query: 'query{ accounts { id } }' } },
    });
    expect(getViewScope(listish, 'accountById')).toBe('list');
  });

  it('defaults to list when there is no scope and no by-id match', () => {
    expect(getViewScope(makeSpec())).toBe('list');
  });
});

describe('withScope', () => {
  it('returns a copy associated with the given scope without mutating the original', () => {
    const original = makeSpec();
    const scoped = withScope(original, 'detail');
    expect(scoped.scope).toBe('detail');
    expect(original.scope).toBeUndefined();
  });
});

describe('view / column association (regression for the detail-column bug)', () => {
  it('a view created on a detail column is associated with the detail type', () => {
    // Simulates creating a view while a detail column is active.
    const created = withScope(makeSpec({ concept: 'Account' }), 'detail');
    expect(getViewScope(created)).toBe('detail');
  });

  it('a detail-scoped view is shown on the detail column, never the list column', () => {
    const detailView = withScope(makeSpec(), 'detail');
    expect(isViewForColumn(detailView, 'detail')).toBe(true);
    expect(isViewForColumn(detailView, 'list')).toBe(false);
  });

  it('a list-scoped view is shown on the list column, never the detail column', () => {
    const listView = withScope(makeSpec(), 'list');
    expect(isViewForColumn(listView, 'list')).toBe(true);
    expect(isViewForColumn(listView, 'detail')).toBe(false);
  });
});
