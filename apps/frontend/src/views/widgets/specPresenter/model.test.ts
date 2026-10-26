import { describe, expect, it } from 'vitest';
import {
  columnCount,
  compareByCell,
  openableConcept,
  parseSpecNode,
  refKey,
  rootKeys,
  linkedCells,
  diffCodeWidget,
  openPageKey,
  rowRef,
  tableRows,
  treeRows,
} from './model';
import { fameTab, methodsTable, packagesTree, methodDiff, sourceNotebook } from './specPresenterFixture';

describe('parseSpecNode', () => {
  it('accepts a Spec-Fluid document, composites included', () => {
    expect(parseSpecNode(fameTab).node).toEqual(fameTab);
  });

  it('explains a missing document', () => {
    expect(parseSpecNode(undefined).reason).toMatch(/returned nothing/);
    expect(parseSpecNode(null).reason).toMatch(/returned nothing/);
  });

  it('explains an invalid document, with where it breaks', () => {
    const reason = parseSpecNode({ kind: 'composite', direction: 'row', children: [{ kind: 'table' }] }).reason;
    expect(reason).toMatch(/^Not a Spec-Fluid document \(at children\.0\.columns\)/);
    expect(parseSpecNode({ root: fameTab }).reason).toMatch(/Bind "data" to the tab's "root"/);
  });
});

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
    if (packagesTree.kind !== 'tree') throw new Error('fixture');
    const rows = treeRows(packagesTree.roots);
    expect(rows[0].key).toBe('0');
    expect(rows[0].children?.[0]).toMatchObject({ key: '0.0', hasMore: true, children: undefined });
    expect(rootKeys(rows)).toEqual(['0']);
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

describe('notebooks', () => {
  it('accepts a notebook document', () => {
    expect(parseSpecNode(sourceNotebook).node).toEqual(sourceNotebook);
  });

  it('opens on the selected page, else the first one', () => {
    expect(openPageKey(2, 1)).toBe('1');
    expect(openPageKey(2, undefined)).toBe('0');
    expect(openPageKey(2, 5)).toBe('0');
  });
});

describe('diffCodeWidget', () => {
  it('compares the newer text to the older one, under its label', () => {
    expect(parseSpecNode(methodDiff).node).toEqual(methodDiff);
    expect(diffCodeWidget(methodDiff as Extract<typeof methodDiff, { kind: 'diff' }>)).toMatchObject({
      type: 'code',
      field: 'after',
      language: 'smalltalk',
      compare: { field: 'before', label: 'parent' },
    });
  });
});
