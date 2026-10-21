import { describe, expect, it } from 'vitest';
import { buildColumns, columnSubtitle, columnTitle, parseMillerPath } from './model';

describe('parseMillerPath', () => {
  it('reads the root concept and the drill-in pairs', () => {
    expect(parseMillerPath('Account/Customer/C1/Order/O1')).toEqual({
      root: 'Account',
      stack: [
        { conceptName: 'Customer', itemId: 'C1' },
        { conceptName: 'Order', itemId: 'O1' },
      ],
    });
  });

  it('ignores an incomplete trailing pair and empty segments', () => {
    expect(parseMillerPath('/Account//Customer/')).toEqual({ root: 'Account', stack: [] });
    expect(parseMillerPath('')).toEqual({ root: undefined, stack: [] });
  });
});

describe('buildColumns', () => {
  it('chains each column path onto its parent', () => {
    const columns = buildColumns('Account', [
      { conceptName: 'Customer', itemId: 'C 1' },
      { conceptName: 'Order', itemId: 'O1' },
    ]);
    expect(columns.map((c) => [c.path, c.parentPath])).toEqual([
      ['/miller/Account', undefined],
      ['/miller/Account/Customer/C%201', '/miller/Account'],
      ['/miller/Account/Customer/C%201/Order/O1', '/miller/Account/Customer/C%201'],
    ]);
  });
});

describe('titles', () => {
  it('names list and detail columns', () => {
    expect(columnTitle({ conceptName: 'Account' })).toBe('Account (work list)');
    expect(columnTitle({ conceptName: 'Order', itemId: 'O1' })).toBe('Order: O1');
    expect(columnSubtitle('Order')).toBe('Entity Type: Order');
  });
});
