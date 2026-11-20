import { describe, expect, it, vi } from 'vitest';
import type { ViewItem } from '@fluid/shared';
import {
  appendPage,
  initialItems,
  itemAt,
  itemsPath,
  loadAll,
  MAX_PAGES,
  missingCount,
  needsChildren,
  withChildren,
  type ItemsLoader,
} from './itemsModel';

const item = (text: string, extra: Partial<ViewItem> = {}): ViewItem => ({ cells: [{ text }], ...extra });

describe('items state', () => {
  it('starts from the items, or roots, the node was sent with', () => {
    expect(initialItems({ kind: 'list', items: [item('a')], total: 4 })).toEqual({ items: [item('a')], total: 4 });
    expect(initialItems({ kind: 'tree', roots: [item('r')] })).toEqual({ items: [item('r')], total: undefined });
  });

  it('counts the missing items only when the total is known', () => {
    expect(missingCount({ items: [item('a')], total: 3 })).toBe(2);
    expect(missingCount({ items: [item('a')] })).toBe(0);
    expect(missingCount({ items: [item('a'), item('b')], total: 1 })).toBe(0);
  });

  it('appends a page, the new total winning', () => {
    expect(appendPage({ items: [item('a')], total: 3 }, { items: [item('b')], total: 5 })).toEqual({ items: [item('a'), item('b')], total: 5 });
    expect(appendPage({ items: [], total: 3 }, { items: [item('b')] }).total).toBe(3);
  });

  it('names a node, or an item of its tree, as the items route does', () => {
    expect(itemsPath(1)).toBe('1');
    expect(itemsPath(1, '3.0')).toBe('1.3.0');
  });
});

describe('loadAll', () => {
  it('fetches page after page until the total is reached', async () => {
    const load = vi.fn<ItemsLoader>((_path, offset) =>
      Promise.resolve({ items: offset < 4 ? [item(`i${offset}`), item(`i${offset + 1}`)] : [], total: 4 }),
    );
    const state = await loadAll(load, '0');
    expect(state.items.map((i) => i.cells[0].text)).toEqual(['i0', 'i1', 'i2', 'i3']);
    expect(load.mock.calls.map((c) => c.slice(0, 2))).toEqual([
      ['0', 0],
      ['0', 2],
    ]);
  });

  it('stops at the first page without a total or empty, and never loops forever', async () => {
    const once = vi.fn<ItemsLoader>(() => Promise.resolve({ items: [item('a')] }));
    expect((await loadAll(once, '0')).items).toHaveLength(1);
    const endless = vi.fn<ItemsLoader>(() => Promise.resolve({ items: [item('a')], total: 1_000_000 }));
    await loadAll(endless, '0');
    expect(endless).toHaveBeenCalledTimes(MAX_PAGES);
  });
});

describe('tree children', () => {
  const roots = [item('a', { children: [item('a0', { hasChildren: true })] }), item('b', { hasChildren: true })];

  it('finds an item by its path', () => {
    expect(itemAt(roots, '0.0')?.cells[0].text).toBe('a0');
    expect(itemAt(roots, '2')).toBeUndefined();
  });

  it('knows which items wait for their children', () => {
    expect(needsChildren(roots, '1')).toBe(true);
    expect(needsChildren(roots, '0.0')).toBe(true);
    expect(needsChildren(roots, '0')).toBe(false);
  });

  it('puts loaded children in place, without touching the rest', () => {
    const next = withChildren(roots, '0.0', [item('leaf')]);
    expect(itemAt(next, '0.0.0')?.cells[0].text).toBe('leaf');
    expect(needsChildren(next, '0.0')).toBe(false);
    expect(next[1]).toBe(roots[1]);
    expect(itemAt(roots, '0.0')?.children).toBeUndefined();
  });
});
