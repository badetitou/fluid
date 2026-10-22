import { describe, expect, it } from 'vitest';
import { buildColumns, columnSlot, columnSubtitle, columnTitle, resolveRoot, reuseColumns } from './model';

const saved = { id: 'x', title: 'Rick', concept: 'Character', itemId: '1', perspective: 'p' };

describe('resolveRoot', () => {
  it('opens the Concepts page, a concept column or a saved dashboard', () => {
    const find = (id: string) => (id === 'x' ? saved : undefined);
    expect(resolveRoot({ kind: 'home' }, find)).toEqual({ kind: 'home' });
    expect(resolveRoot({ kind: 'column', concept: 'Order' }, find)).toEqual({ kind: 'concept', conceptName: 'Order', itemId: undefined });
    expect(resolveRoot({ kind: 'dashboard', id: 'x' }, find)).toEqual({
      kind: 'concept',
      conceptName: 'Character',
      itemId: '1',
      perspective: 'p',
      title: 'Rick',
    });
    expect(resolveRoot({ kind: 'dashboard', id: 'gone' }, find)).toBeNull();
  });
});

describe('buildColumns', () => {
  it('chains each column path onto its parent', () => {
    const columns = buildColumns('~x', { kind: 'concept', conceptName: 'Character', itemId: '1' }, [
      { concept: 'Location' },
      { concept: 'Location', itemId: 'L 1' },
    ]);
    expect(columns.map((c) => [c.path, c.parentPath])).toEqual([
      ['/d/~x', undefined],
      ['/d/~x/Location', '/d/~x'],
      ['/d/~x/Location/Location@L%201', '/d/~x/Location'],
    ]);
    expect(columns[2]).toMatchObject({ kind: 'concept', conceptName: 'Location', itemId: 'L 1' });
  });

  it('starts from the Concepts page', () => {
    expect(buildColumns('@home', { kind: 'home' }, [{ concept: 'Order' }]).map((c) => c.kind)).toEqual(['home', 'concept']);
  });
});

describe('titles', () => {
  it('names list, detail, saved and home columns', () => {
    expect(columnTitle({ conceptName: 'Account' })).toBe('Account (work list)');
    expect(columnTitle({ conceptName: 'Order', itemId: 'O1' })).toBe('Order: O1');
    expect(columnTitle({ conceptName: 'Order', itemId: 'O1', title: 'My order' })).toBe('My order');
    expect(columnTitle({ kind: 'home', conceptName: '' })).toBe('Concepts');
    expect(columnSubtitle('Order')).toBe('Entity Type: Order');
  });
});

describe('columnSlot', () => {
  it('is shared by the items of one concept at one position', () => {
    const [, a] = buildColumns('Character', { kind: 'concept', conceptName: 'Character' }, [{ concept: 'Character', itemId: '1' }]);
    const [, b] = buildColumns('Character', { kind: 'concept', conceptName: 'Character' }, [{ concept: 'Character', itemId: '2' }]);
    expect(a.path).not.toBe(b.path);
    expect(a.slot).toBe(b.slot);
  });

  it('tells apart positions, concepts, lists and items, and dashboard perspectives', () => {
    const slots = [
      columnSlot(1, { kind: 'concept', conceptName: 'Character', itemId: '1' }),
      columnSlot(2, { kind: 'concept', conceptName: 'Character', itemId: '1' }),
      columnSlot(1, { kind: 'concept', conceptName: 'Location', itemId: '1' }),
      columnSlot(1, { kind: 'concept', conceptName: 'Character' }),
      columnSlot(1, { kind: 'concept', conceptName: 'Character', itemId: '1', perspective: 'p' }),
      columnSlot(0, { kind: 'home', conceptName: '' }),
    ];
    expect(new Set(slots).size).toBe(slots.length);
  });
});

describe('reuseColumns', () => {
  it('keeps the unchanged columns and takes the new ones', () => {
    const root = { kind: 'concept' as const, conceptName: 'Character' };
    const prev = buildColumns('Character', root, [{ concept: 'Character', itemId: '1' }, { concept: 'Location' }]);
    const next = buildColumns('Character', root, [{ concept: 'Character', itemId: '2' }]);
    const reused = reuseColumns(prev, next);
    expect(reused[0]).toBe(prev[0]);
    expect(reused[1]).toBe(next[1]);
    expect(reused).toHaveLength(2);
  });
});
