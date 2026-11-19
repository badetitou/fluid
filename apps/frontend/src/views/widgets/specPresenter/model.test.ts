import { describe, expect, it } from 'vitest';
import {
  columnCount,
  confirmQuestion,
  compareByCell,
  openableConcept,
  refKey,
  rootKeys,
  labelLine,
  linkedCells,
  diffCodeWidget,
  openPageKey,
  rowRef,
  tableRows,
  treeRows,
} from './model';
import { specFluidNodeToViewNode } from '@fluid/shared';
import { commitHeader, methodsTable, packagesTree, methodDiff } from './specPresenterFixture';

describe('openableConcept', () => {
  it('opens a typed entity when every type is allowed or its type is openable', () => {
    expect(openableConcept({ id: '1', type: 'Class' }, null)).toBe('Class');
    expect(openableConcept({ id: '1', type: 'Class' }, new Set(['Class']))).toBe('Class');
  });

  it('does not open an untyped entity, nor a type the source cannot open', () => {
    expect(openableConcept({ id: '1' }, null)).toBeUndefined();
    expect(openableConcept({ id: '1', type: 'Class' }, new Set(['Method']))).toBeUndefined();
    expect(openableConcept(undefined, null)).toBeUndefined();
  });
});

describe('rows', () => {
  it('keys table rows and finds their entity, own or of a cell', () => {
    if (methodsTable.kind !== 'table') throw new Error('fixture');
    const rows = tableRows(methodsTable.rows);
    expect(rows.map((r) => r.key)).toEqual(['0', '1', '2']);
    expect(rowRef(rows[0])).toEqual({ id: 'm1', type: 'Method' });
    expect(rowRef(rows[2])).toEqual({ id: 'm3', type: 'Method' });
    expect(rowRef({ cells: [{ text: 'x' }] })).toBeUndefined();
  });

  it('nests tree rows by path, leaves without children, roots unfolded', () => {
    const tree = specFluidNodeToViewNode(packagesTree);
    if (tree.kind !== 'tree') throw new Error('fixture');
    const rows = treeRows(tree.roots);
    expect(rows[0].key).toBe('0');
    expect(rows[0].children?.[0]).toMatchObject({ key: '0.0', truncated: true, children: undefined });
    expect(rootKeys(rows)).toEqual(['0']);
  });

  it('gives an item announcing unsent children an empty, lazy children list, not unfolded', () => {
    const rows = treeRows([{ cells: [{ text: 'a' }], hasChildren: true }, { cells: [{ text: 'b' }], children: [] }]);
    expect(rows[0]).toMatchObject({ lazy: true, children: [] });
    expect(rows[1]).toMatchObject({ lazy: false, children: undefined });
    expect(rootKeys(rows)).toEqual([]);
  });

  it('sorts by the text of a cell, numbers as numbers', () => {
    if (methodsTable.kind !== 'table') throw new Error('fixture');
    const rows = tableRows(methodsTable.rows);
    expect([...rows].sort(compareByCell(1)).map((r) => r.cells[1].text)).toEqual(['9', '12', '100']);
    expect([...rows].sort(compareByCell(0)).map((r) => r.cells[0].text)).toEqual(['add:', 'printOn:', 'size']);
  });

  it('counts the columns, the widest row winning over missing titles', () => {
    expect(columnCount([{ title: 'A' }], tableRows([{ cells: [{ text: '1' }, { text: '2' }] }]))).toBe(2);
    expect(columnCount([{ title: 'A' }, { title: 'B' }], [])).toBe(2);
  });

  it('keys an entity by type and id', () => {
    expect(refKey({ id: '1', type: 'Class' })).not.toBe(refKey({ id: '1', type: 'Method' }));
    expect(refKey({ id: '1' })).toBe('#1');
  });
});

describe('linkedCells', () => {
  const ref = { id: '1:2', type: 'ClassBody' };
  it('links the first cell to the row entity when no cell links', () => {
    expect(linkedCells([{ text: 'a' }, { text: 'b' }], ref)).toEqual([{ text: 'a', ref }, { text: 'b' }]);
  });
  it('keeps cells that already link, and rows without entity', () => {
    const cells = [{ text: 'a' }, { text: 'b', ref: { id: 'x' } }];
    expect(linkedCells(cells, ref)).toBe(cells);
    expect(linkedCells([{ text: 'a' }], undefined)).toEqual([{ text: 'a' }]);
  });
});

describe('tabs', () => {
  it('opens on the selected page, else the first one', () => {
    expect(openPageKey(2, 1)).toBe('1');
    expect(openPageKey(2, undefined)).toBe('0');
    expect(openPageKey(2, 5)).toBe('0');
  });
});

describe('diffCodeWidget', () => {
  it('compares the newer text to the older one, under its label', () => {
    expect(diffCodeWidget(methodDiff as Extract<typeof methodDiff, { kind: 'diff' }>)).toMatchObject({
      type: 'code',
      field: 'after',
      language: 'smalltalk',
      compare: { field: 'before', label: 'parent' },
    });
  });
});

describe('labelLine', () => {
  const [header, message] = (commitHeader as Extract<typeof commitHeader, { kind: 'composite' }>).children;
  it('joins a row of labels into one line', () => {
    expect(labelLine(header as Extract<typeof header, { kind: 'composite' }>)).toBe('Commit authored 2/10/2026 by');
  });

  it('leaves other composites alone', () => {
    expect(labelLine({ kind: 'composite', direction: 'row', children: [header, message] })).toBeUndefined();
    expect(labelLine({ kind: 'composite', direction: 'column', children: [{ kind: 'label', text: 'a' }] })).toBeUndefined();
  });
});

describe('confirmQuestion', () => {
  it('asks with the action label, or its own text, or not at all', () => {
    expect(confirmQuestion({ id: 'd', label: 'Delete', confirm: true })).toBe('Delete?');
    expect(confirmQuestion({ id: 'd', label: 'Delete', confirm: 'Really?' })).toBe('Really?');
    expect(confirmQuestion({ id: 'd', label: 'Delete', confirm: false })).toBeUndefined();
    expect(confirmQuestion({ id: 'd', label: 'Delete' })).toBeUndefined();
  });
});
