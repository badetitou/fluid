import { MATRIX_MAX_SIDE, type MatrixWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { idOf, rowsOf } from '../network/networkModel';
import { nodeLabel, type Row } from '../tree/treeModel';

// Pure logic of the dependency matrix: turns the bound elements and the
// targets they list into the two axes and the weight of every dependency.

export interface MatrixItem {
  /** The element's (or target's) id, as a string: unique on its axis. */
  key: string;
  label: string;
  /** The element row; for a target of a `targets` matrix, the target object (or `{ id }`). */
  row: Row;
  group?: string;
  /** Position in the data: the "original" order. */
  index: number;
}

export interface Matrix {
  rows: MatrixItem[];
  /** The same items as `rows` in a DSM; the distinct targets in a `targets` matrix. */
  cols: MatrixItem[];
  /** `weights.get(rowKey)?.get(colKey)`: the summed weight of the dependency. */
  weights: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Highest weight off the diagonal. */
  max: number;
  /** Cells with a dependency, off the diagonal. */
  links: number;
  /** A DSM: the same elements on both axes. */
  square: boolean;
  /** The group values, in order of appearance. */
  groups: string[];
  /** DSM: target occurrences that are not among the elements (ignored). */
  outside: number;
}

export type MatrixOptions = Pick<
  MatrixWidget,
  | 'rowsField'
  | 'idField'
  | 'labelField'
  | 'groupField'
  | 'targetsField'
  | 'targetIdField'
  | 'targetLabelField'
  | 'weightField'
  | 'columns'
>;

const scalar = (value: unknown) => (value == null || typeof value === 'object' ? undefined : String(value));
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);

/** The elements of the bound data: the rows, or those under `rowsField`. */
export function elementRows(data: unknown, rowsField?: string): Row[] {
  return rowsOf(rowsField ? getPath(data, rowsField) : data);
}

function groupOf(row: Row, groupField?: string): string | undefined {
  return groupField ? scalar(getPath(row, groupField)) : undefined;
}

/** The weight a target counts for: its `weightField` when numeric, else 1. */
export function weightOf(target: unknown, weightField?: string): number {
  if (!weightField || target == null || typeof target !== 'object') return 1;
  const value = getPath(target, weightField);
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 1;
}

function elements(data: unknown, options: MatrixOptions): MatrixItem[] {
  const items = new Map<string, MatrixItem>();
  for (const row of elementRows(data, options.rowsField)) {
    const key = scalar(getPath(row, options.idField ?? 'id'));
    if (key === undefined || items.has(key)) continue;
    items.set(key, { key, label: nodeLabel(row, options.labelField), row, group: groupOf(row, options.groupField), index: items.size });
  }
  return [...items.values()];
}

function targetItem(target: unknown, key: string, options: MatrixOptions, index: number): MatrixItem {
  const [row] = rowsOf(target);
  if (!row) return { key, label: key, row: { id: target }, index };
  return { key, label: nodeLabel(row, options.targetLabelField), row, group: groupOf(row, options.groupField), index };
}

/** The axes and weights of the matrix. */
export function buildMatrix(data: unknown, options: MatrixOptions): Matrix {
  const rows = elements(data, options);
  const square = options.columns !== 'targets';
  const known = new Map(rows.map((r) => [r.key, r]));
  const targets = new Map<string, MatrixItem>();
  const weights = new Map<string, Map<string, number>>();
  let outside = 0;
  for (const source of rows) {
    const out = new Map<string, number>();
    for (const target of listOf(getPath(source.row, options.targetsField))) {
      const key = idOf(target, options.targetIdField ?? 'id');
      if (key === undefined) continue;
      if (square && !known.has(key)) {
        outside += 1;
        continue;
      }
      if (!square && !targets.has(key)) targets.set(key, targetItem(target, key, options, targets.size));
      out.set(key, (out.get(key) ?? 0) + weightOf(target, options.weightField));
    }
    if (out.size > 0) weights.set(source.key, out);
  }
  const cols = square ? rows : [...targets.values()];
  let max = 0;
  let links = 0;
  for (const [r, out] of weights)
    for (const [c, w] of out)
      if (!(square && r === c) && w > 0) {
        links += 1;
        max = Math.max(max, w);
      }
  const groups = [...new Set([...rows, ...cols].flatMap((i) => (i.group === undefined ? [] : [i.group])))];
  return { rows, cols, weights, max, links, square, groups, outside };
}

export const weightAt = (m: Matrix, row: string, col: string): number => m.weights.get(row)?.get(col) ?? 0;

/** A DSM cell whose two elements depend on each other. */
export const isCycle = (m: Matrix, row: string, col: string): boolean =>
  m.square && row !== col && weightAt(m, row, col) > 0 && weightAt(m, col, row) > 0;

/** The pairs of elements depending on each other. */
export function countCycles(m: Matrix): number {
  let cells = 0;
  for (const [r, out] of m.weights) for (const c of out.keys()) if (isCycle(m, r, c)) cells += 1;
  return cells / 2;
}

/** Why there is no matrix to draw, if so. */
export function emptyReason(data: unknown, m: Matrix, options: MatrixOptions): string | undefined {
  const found = elementRows(data, options.rowsField).length;
  if (found === 0)
    return options.rowsField && rowsOf(data).length > 0
      ? `No elements: the rows have nothing in "${options.rowsField}".`
      : 'No elements: the query returned no rows.';
  if (m.rows.length === 0) return `No element has an id in "${options.idField ?? 'id'}": set "idField".`;
  if (m.rows.length > MATRIX_MAX_SIDE || m.cols.length > MATRIX_MAX_SIDE)
    return `Too many elements to draw (${m.rows.length} × ${m.cols.length}, at most ${MATRIX_MAX_SIDE} per side): filter or limit the query.`;
  if (m.links > 0) return undefined;
  if (m.square && m.outside > 0)
    return `No dependency between the elements: their ${m.outside} targets in "${options.targetsField}" are not among the rows.`;
  return `No dependency: no element lists targets in "${options.targetsField}".`;
}
