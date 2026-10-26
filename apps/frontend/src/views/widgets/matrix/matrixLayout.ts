import type { MatrixSort } from '@fluid/shared';
import { isCycle, type Matrix, type MatrixItem } from './matrixModel';

// Pure geometry of the matrix: the order of the axes, the size of the cells
// for the available width, and the cells to draw.

export interface MatrixAxes {
  rows: MatrixItem[];
  cols: MatrixItem[];
}

/** The order of the axes when the widget does not set one. */
export const defaultSort = (sort: MatrixSort | undefined, groupField: string | undefined): MatrixSort =>
  sort ?? (groupField ? 'group' : 'original');

function totals(m: Matrix, axis: 'out' | 'in' | 'both'): Map<string, number> {
  const sums = new Map<string, number>();
  const add = (key: string, w: number) => sums.set(key, (sums.get(key) ?? 0) + w);
  for (const [r, out] of m.weights)
    for (const [c, w] of out) {
      if (m.square && r === c) continue;
      if (axis !== 'in') add(r, w);
      if (axis !== 'out') add(c, w);
    }
  return sums;
}

const byLabel = (a: MatrixItem, b: MatrixItem) => a.label.localeCompare(b.label) || a.index - b.index;

function sortItems(items: MatrixItem[], sort: MatrixSort, weights: () => Map<string, number>): MatrixItem[] {
  const sorted = [...items];
  if (sort === 'original') return sorted.sort((a, b) => a.index - b.index);
  if (sort === 'name') return sorted.sort(byLabel);
  if (sort === 'group')
    return sorted.sort((a, b) => {
      if (a.group === b.group) return byLabel(a, b);
      if (a.group === undefined || b.group === undefined) return a.group === undefined ? 1 : -1;
      return a.group.localeCompare(b.group);
    });
  const sums = weights();
  return sorted.sort((a, b) => (sums.get(b.key) ?? 0) - (sums.get(a.key) ?? 0) || byLabel(a, b));
}

/** The axes in `sort` order; a DSM keeps the same order on both, by total weight in and out. */
export function orderAxes(m: Matrix, sort: MatrixSort): MatrixAxes {
  if (m.square) {
    const rows = sortItems(m.rows, sort, () => totals(m, 'both'));
    return { rows, cols: rows };
  }
  return { rows: sortItems(m.rows, sort, () => totals(m, 'out')), cols: sortItems(m.cols, sort, () => totals(m, 'in')) };
}

/** Indexes where the group changes along an axis: where to draw a separator. */
export function groupBreaks(items: MatrixItem[]): number[] {
  return items.flatMap((item, i) => (i > 0 && item.group !== items[i - 1].group ? [i] : []));
}

export interface MatrixCell {
  row: MatrixItem;
  col: MatrixItem;
  /** Position on the axes. */
  i: number;
  j: number;
  weight: number;
  cycle: boolean;
}

/** The cells holding a dependency, off the diagonal of a DSM. */
export function cellsOf(m: Matrix, axes: MatrixAxes): MatrixCell[] {
  const colIndex = new Map(axes.cols.map((c, j) => [c.key, j]));
  return axes.rows.flatMap((row, i) =>
    [...(m.weights.get(row.key) ?? new Map<string, number>())].flatMap(([key, weight]) => {
      const j = colIndex.get(key);
      if (j === undefined || weight <= 0 || (m.square && key === row.key)) return [];
      return [{ row, col: axes.cols[j], i, j, weight, cycle: isCycle(m, row.key, key) }];
    }),
  );
}

export interface MatrixGeometry {
  cell: number;
  /** Width of the row labels (and group band); x of the first column. */
  left: number;
  /** Height of the column labels (and group band); y of the first row. */
  top: number;
  width: number;
  height: number;
  /** Labels are written (the cells are tall enough); else only their hit areas remain. */
  labels: boolean;
  fontSize: number;
  /** Width of the group bands (0 without groups). */
  band: number;
}

const MIN_CELL = 3;
const MAX_CELL = 24;
const LABEL_MIN_CELL = 10;
const CHAR_WIDTH = 6.5;
export const LABEL_MAX_CHARS = 24;
const HIT = 8;

const labelSpace = (chars: number) => Math.min(LABEL_MAX_CHARS, Math.max(chars, 1)) * CHAR_WIDTH + 10;
const fit = (available: number, used: number, count: number) =>
  Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((available - used) / Math.max(count, 1))));

/** Cells as large as the width allows (between 3 and 24 px), labels written when they fit. */
export function layoutMatrix(axes: MatrixAxes, available: number, groups: boolean): MatrixGeometry {
  const band = groups ? 6 : 0;
  const longest = (items: MatrixItem[]) => items.reduce((n, i) => Math.max(n, i.label.length), 0);
  const rowLabels = labelSpace(longest(axes.rows));
  let cell = fit(available, rowLabels + band + 2, axes.cols.length);
  const labels = cell >= LABEL_MIN_CELL;
  if (!labels) cell = fit(available, HIT + band + 2, axes.cols.length);
  const left = (labels ? rowLabels : HIT) + band;
  const top = (labels ? labelSpace(longest(axes.cols)) : HIT) + band;
  return {
    cell,
    left,
    top,
    width: left + axes.cols.length * cell + 1,
    height: top + axes.rows.length * cell + 1,
    labels,
    fontSize: Math.min(12, cell - 2),
    band,
  };
}

/** A label cut to what the label area holds. */
export const truncate = (label: string): string =>
  label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label;
