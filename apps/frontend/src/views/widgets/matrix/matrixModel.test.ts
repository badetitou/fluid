import { describe, expect, it } from 'vitest';
import { characterEpisodesMatrixExample, classDependencyMatrixExample, type MatrixWidget } from '@fluid/shared';
import { resolveBinding } from '../../data';
import { countCycles, buildMatrix, emptyReason, isCycle, weightAt, weightOf } from './matrixModel';
import { cellsOf, defaultSort, layoutMatrix, orderAxes } from './matrixLayout';
import { cellOpacity } from './matrixStyle';
import { dsmClasses, rickAndMortyCharacters } from './matrixFixture';

const dsm = classDependencyMatrixExample.widgets[0] as MatrixWidget;
const dsmData = resolveBinding(dsm.data, { classes: { classes: dsmClasses } });
const co = characterEpisodesMatrixExample.widgets[0] as MatrixWidget;
const coData = resolveBinding(co.data, { characters: rickAndMortyCharacters });

describe('buildMatrix', () => {
  const m = buildMatrix(dsmData, dsm);

  it('sums repeated targets and ignores targets outside the rows', () => {
    expect(weightAt(m, 'c:A', 'c:B')).toBe(2);
    expect(weightAt(m, 'c:A', 'c:C')).toBe(1);
    expect(m.outside).toBe(1);
    expect(m.max).toBe(2);
    expect(m.links).toBe(4);
  });

  it('finds the cycles, not the diagonal', () => {
    expect(isCycle(m, 'c:A', 'c:B')).toBe(true);
    expect(isCycle(m, 'c:B', 'c:B')).toBe(false);
    expect(isCycle(m, 'c:A', 'c:C')).toBe(false);
    expect(countCycles(m)).toBe(1);
    expect(m.groups).toEqual(['Collections', 'Abstract']);
  });

  it('builds a co-usage map with the distinct targets in columns', () => {
    const c = buildMatrix(coData, co);
    expect(c.square).toBe(false);
    expect(c.rows).toHaveLength(3);
    expect(c.cols.map((x) => x.label)).toEqual(['S01E01', 'S01E02', 'S01E03']);
    expect(weightAt(c, '1', '3')).toBe(1);
    expect(isCycle(c, '1', '1')).toBe(false);
  });

  it('reads weights from weightField', () => {
    const rows = [
      { id: 'a', deps: [{ n: 5, to: 'b' }] },
      { id: 'b', deps: [] },
    ];
    const w = buildMatrix(rows, { targetsField: 'deps', targetIdField: 'to', weightField: 'n' });
    expect(weightAt(w, 'a', 'b')).toBe(5);
    expect(weightOf({ n: 'x' }, 'n')).toBe(1);
    expect(weightOf('b', 'n')).toBe(1);
  });

  it('reads elements under rowsField', () => {
    const pkgs = [{ classes: [{ id: 'a', t: ['b'] }, { id: 'b' }] }];
    expect(buildMatrix(pkgs, { rowsField: 'classes', targetsField: 't' }).links).toBe(1);
  });
});

describe('emptyReason', () => {
  it('explains each empty case', () => {
    expect(emptyReason([], buildMatrix([], dsm), dsm)).toMatch(/no rows/);
    expect(emptyReason([{ name: 'x' }], buildMatrix([{ name: 'x' }], dsm), dsm)).toMatch(/idField/);
    const lone = [{ id: 'a' }];
    expect(emptyReason(lone, buildMatrix(lone, dsm), dsm)).toMatch(/no element lists targets/);
    const out = [{ id: 'a', t: ['zz'] }];
    const opts = { targetsField: 't' };
    expect(emptyReason(out, buildMatrix(out, opts), opts)).toMatch(/not among the rows/);
    expect(emptyReason(dsmData, buildMatrix(dsmData, dsm), dsm)).toBeUndefined();
  });

  it('refuses more than 300 elements per side', () => {
    const many = Array.from({ length: 301 }, (_, i) => ({ id: String(i), t: ['0'] }));
    const opts = { targetsField: 't' };
    expect(emptyReason(many, buildMatrix(many, opts), opts)).toMatch(/Too many/);
  });
});

describe('layout', () => {
  const m = buildMatrix(dsmData, dsm);

  it('orders both axes alike in a DSM', () => {
    expect(defaultSort(undefined, 'g')).toBe('group');
    expect(defaultSort(undefined, undefined)).toBe('original');
    expect(orderAxes(m, 'name').rows.map((r) => r.label)).toEqual(['Array', 'Bag', 'Collection', 'Dictionary']);
    expect(orderAxes(m, 'group').rows.map((r) => r.label)).toEqual(['Collection', 'Dictionary', 'Array', 'Bag']);
    const axes = orderAxes(m, 'weight');
    expect(axes.rows[0].label).toBe('Array');
    expect(axes.cols).toBe(axes.rows);
  });

  it('lists the cells off the diagonal with their positions', () => {
    const axes = orderAxes(m, 'original');
    const cells = cellsOf(m, axes);
    expect(cells).toHaveLength(4);
    const ab = cells.find((c) => c.row.key === 'c:A' && c.col.key === 'c:B');
    expect(ab).toMatchObject({ i: 0, j: 1, weight: 2, cycle: true });
  });

  it('shrinks the cells with the width and drops labels when too small', () => {
    const axes = orderAxes(m, 'original');
    expect(layoutMatrix(axes, 800, true).labels).toBe(true);
    const tight = layoutMatrix(axes, 40, true);
    expect(tight.labels).toBe(false);
    expect(tight.cell).toBeGreaterThanOrEqual(3);
  });

  it('makes heavier cells more opaque', () => {
    expect(cellOpacity(1, 4)).toBeLessThan(cellOpacity(4, 4));
    expect(cellOpacity(4, 4)).toBe(1);
  });
});
