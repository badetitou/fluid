import { describe, expect, it } from 'vitest';
import { buildColumns, columnSubtitle, columnTitle, resolveRoot } from './model';

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
