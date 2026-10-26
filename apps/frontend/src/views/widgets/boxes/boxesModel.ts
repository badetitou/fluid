import type { BoxesWidget } from '@fluid/shared';
import { getPath } from '../../data';
import { idOf, rowsOf } from '../network/networkModel';
import { nodeLabel, type Row } from '../tree/treeModel';

export type { Row };

// Pure logic of the boxes widget (polymetric view): turns the bound rows into
// boxes with their metrics, their parent (without cycles) and their group, and
// reads how the color field is to be scaled.

/** Beyond this many boxes, the widget asks to filter instead of drawing. */
export const MAX_BOXES = 2000;

export interface BoxItem {
  key: string;
  label: string;
  row: Row;
  /** Value of `groupField`, when the row has one. */
  group?: string;
  /** The box it is drawn under (tree, treemap), when its parent is a box too. */
  parent?: string;
  /** Its direct children, in row order. */
  children: string[];
  /** How many boxes are below it, at any depth. */
  descendants: number;
  width?: number;
  height?: number;
  size?: number;
  /** The value of `colorField`: a number on a sequential scale, a string on a categorical one. */
  color?: number | string;
}

export type ColorScale =
  | { kind: 'none' }
  | { kind: 'sequential'; field: string; min: number; max: number }
  | { kind: 'categorical'; field: string; categories: string[] };

export interface BoxesModel {
  items: ReadonlyMap<string, BoxItem>;
  /** Every key, in row order. */
  order: string[];
  /** The boxes without parent box: the largest hierarchies first. */
  roots: string[];
  /** The group values, the most populated first. */
  groups: string[];
  color: ColorScale;
}

export type BoxesOptions = Pick<
  BoxesWidget,
  | 'idField'
  | 'labelField'
  | 'widthField'
  | 'heightField'
  | 'sizeField'
  | 'colorField'
  | 'colorScale'
  | 'parentField'
  | 'groupField'
>;

/** A finite number from a number or a numeric string, else undefined. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value.find((v) => v != null) : value);
const metric = (row: Row, field?: string) => (field ? toNumber(firstOf(getPath(row, field))) : undefined);

function scalarOf(row: Row, field?: string): string | undefined {
  const value = field ? firstOf(getPath(row, field)) : undefined;
  return value == null || value === '' || typeof value === 'object' ? undefined : String(value);
}

/** The color value of a row, as the scale reads it. */
function colorValue(row: Row, opts: BoxesOptions, sequential: boolean): number | string | undefined {
  if (!opts.colorField) return undefined;
  return sequential ? metric(row, opts.colorField) : scalarOf(row, opts.colorField);
}

/** Whether `colorField` is read as a metric: forced, else when every present value is a number. */
function isSequential(rows: Row[], opts: BoxesOptions): boolean {
  if (opts.colorScale) return opts.colorScale === 'sequential';
  const values = rows.map((r) => firstOf(getPath(r, opts.colorField))).filter((v) => v != null && v !== '');
  return values.length > 0 && values.every((v) => typeof v === 'number' || (typeof v === 'string' && toNumber(v) !== undefined));
}

/** The color scale of the boxes, from the values they carry. */
export function colorScaleOf(items: BoxItem[], field: string | undefined, sequential: boolean): ColorScale {
  if (!field) return { kind: 'none' };
  if (sequential) {
    const values = items.flatMap((i) => (typeof i.color === 'number' ? [i.color] : []));
    if (values.length === 0) return { kind: 'none' };
    return { kind: 'sequential', field, min: Math.min(...values), max: Math.max(...values) };
  }
  const categories = [...new Set(items.flatMap((i) => (typeof i.color === 'string' ? [i.color] : [])))];
  return categories.length ? { kind: 'categorical', field, categories } : { kind: 'none' };
}

/** Whether `ancestor` is `key` or above it, following the parents assigned so far. */
function isAbove(ancestor: string, key: string, items: ReadonlyMap<string, BoxItem>): boolean {
  const seen = new Set<string>();
  for (let at: string | undefined = key; at !== undefined && !seen.has(at); at = items.get(at)?.parent) {
    if (at === ancestor) return true;
    seen.add(at);
  }
  return false;
}

/** Counts each box's descendants, children before parents (the hierarchy has no cycle). */
function countDescendants(items: Map<string, BoxItem>, roots: string[]): void {
  const order: string[] = [];
  const stack = [...roots];
  while (stack.length) {
    const key = stack.pop()!;
    order.push(key);
    stack.push(...items.get(key)!.children);
  }
  for (const key of order.reverse()) {
    const item = items.get(key)!;
    item.descendants = item.children.reduce((n, c) => n + 1 + items.get(c)!.descendants, 0);
  }
}

/** Builds the boxes of the bound rows: one per row (rows without id keyed by position, duplicates dropped). */
export function buildBoxes(data: unknown, opts: BoxesOptions): BoxesModel {
  const rows = rowsOf(data);
  const idField = opts.idField ?? 'id';
  const sequential = isSequential(rows, opts);
  const items = new Map<string, BoxItem>();
  const parents = new Map<string, string>();
  rows.forEach((row, index) => {
    const key = idOf(row, idField) ?? `#${index}`;
    if (items.has(key)) return;
    items.set(key, {
      key,
      label: nodeLabel(row, opts.labelField),
      row,
      group: scalarOf(row, opts.groupField),
      children: [],
      descendants: 0,
      width: metric(row, opts.widthField),
      height: metric(row, opts.heightField),
      size: metric(row, opts.sizeField),
      color: colorValue(row, opts, sequential),
    });
    const parent = opts.parentField ? idOf(firstOf(getPath(row, opts.parentField)), idField) : undefined;
    if (parent !== undefined) parents.set(key, parent);
  });
  for (const [key, parent] of parents) {
    if (!items.has(parent) || isAbove(key, parent, items)) continue;
    items.get(key)!.parent = parent;
    items.get(parent)!.children.push(key);
  }
  const order = [...items.keys()];
  const roots = order.filter((k) => items.get(k)!.parent === undefined);
  countDescendants(items, roots);
  roots.sort((a, b) => items.get(b)!.descendants - items.get(a)!.descendants);
  const counts = new Map<string, number>();
  for (const item of items.values()) if (item.group !== undefined) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);
  const groups = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  return { items, order, roots, groups, color: colorScaleOf([...items.values()], opts.colorField, sequential) };
}

/** The layout drawn: the configured one, else `tree` when there is a parent field, else `flow`. */
export function layoutKind(widget: Pick<BoxesWidget, 'boxLayout' | 'parentField'>): 'tree' | 'flow' | 'treemap' {
  return widget.boxLayout ?? (widget.parentField ? 'tree' : 'flow');
}

/** Why there is nothing to draw (no rows, too many boxes), or null. */
export function emptyReason(model: BoxesModel): string | null {
  if (model.order.length === 0) return 'No boxes: the query returned no rows.';
  if (model.order.length > MAX_BOXES) {
    return `Too many boxes (${model.order.length}, at most ${MAX_BOXES}): filter or limit the query.`;
  }
  return null;
}

/** Why the tree is flat (no row has a parent among the rows), or null. */
export function flatTreeHint(model: BoxesModel, parentField: string | undefined): string | null {
  if (!parentField || model.roots.length < model.order.length) return null;
  return `No hierarchy: no row has its parent among the rows in "${parentField}".`;
}
