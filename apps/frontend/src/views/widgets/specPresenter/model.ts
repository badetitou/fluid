import type { CodeWidget, ViewAction, ViewCell, ViewItem, ViewNode, ViewRef } from '@fluid/shared';

// The pure half of the Open Views presenter: keying the rows of lists and
// trees, sorting cells and deciding which entities can be opened. Reading the
// document is in `parseView.ts`.

/** A stable key of an entity, to compare selections. */
export const refKey = (ref: ViewRef): string => `${ref.type ?? ''}#${ref.id}`;

/**
 * The concept opening `ref` in a new column: its type, when it has one and the
 * source can open it (`openable` null: unknown, every type is allowed).
 */
export function openableConcept(ref: ViewRef | undefined, openable: ReadonlySet<string> | null): string | undefined {
  if (!ref?.type) return undefined;
  return openable === null || openable.has(ref.type) ? ref.type : undefined;
}

/** A table row as antd draws it: its cells, its entity and a key. */
export interface SpecRow {
  key: string;
  cells: ViewCell[];
  ref?: ViewRef;
  /** The provider has more children than it sent, and cannot page them. */
  truncated?: boolean;
  /** Its children come from the items route, once unfolded (`children` is then empty). */
  lazy?: boolean;
  /** Absent on leaves, so antd draws no expand button. */
  children?: SpecRow[];
}

/** The entity a row stands for: its own, else the first one of its cells. */
export const rowRef = (row: Pick<SpecRow, 'cells' | 'ref'>): ViewRef | undefined =>
  row.ref ?? row.cells.find((cell) => cell.ref)?.ref;

/**
 * The cells of a row naming an entity: when none links anywhere, the first one
 * links to the row's entity (Pharo puts the entity on the row, e.g. FAST trees).
 */
export function linkedCells(cells: ViewCell[], ref: ViewRef | undefined): ViewCell[] {
  if (!ref || cells.length === 0 || cells.some((cell) => cell.ref)) return cells;
  return [{ ...cells[0], ref }, ...cells.slice(1)];
}

/** The items of a list or columned list as flat rows, keyed by position. */
export function tableRows(items: Pick<ViewItem, 'cells' | 'ref'>[]): SpecRow[] {
  return items.map((item, index) => ({ key: String(index), cells: linkedCells(item.cells, item.ref), ref: item.ref }));
}

/**
 * The roots of a tree as nested rows, keyed by their item path ("0.2.1", as
 * the items route names it). An item announcing children it did not send gets
 * an empty `children`, so antd draws an expand button.
 */
export function treeRows(items: ViewItem[], prefix = ''): SpecRow[] {
  return items.map((item, index) => {
    const key = prefix ? `${prefix}.${index}` : String(index);
    const lazy = !item.children && item.hasChildren === true;
    const children = item.children?.length ? treeRows(item.children, key) : lazy ? [] : undefined;
    return { key, cells: linkedCells(item.cells, item.ref), ref: item.ref, truncated: item.truncated, lazy, children };
  });
}

/** Keys of the rows unfolded at first: the roots whose children were sent. */
export const rootKeys = (rows: SpecRow[]): string[] => rows.filter((row) => row.children?.length).map((row) => row.key);

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Orders rows by the text of their cell `column` (numbers in text compare as numbers). */
export const compareByCell =
  (column: number) =>
  (a: SpecRow, b: SpecRow): number =>
    collator.compare(a.cells[column]?.text ?? '', b.cells[column]?.text ?? '');

/** Number of columns of a table: the declared ones, else the widest row. */
export function columnCount(columns: { title: string }[], rows: SpecRow[]): number {
  const widest = (list: SpecRow[]): number =>
    list.reduce((max, row) => Math.max(max, row.cells.length, row.children ? widest(row.children) : 0), 0);
  return Math.max(columns.length, widest(rows));
}

/** The key of the tab a `tabs` node opens on: the selected one, else the first one. */
export function openPageKey(pageCount: number, selected: number | undefined): string {
  return String(selected !== undefined && selected < pageCount ? selected : 0);
}

/** A diff node as a code widget comparing its two texts (`data` is the node itself). */
export function diffCodeWidget(node: Extract<ViewNode, { kind: 'diff' }>): CodeWidget {
  return {
    id: 'spec-diff',
    type: 'code',
    data: { query: 'spec-diff' },
    field: 'after',
    language: node.language,
    compare: { field: 'before', label: node.beforeLabel || undefined },
  };
}

/** The text of a row of labels only (a header line), drawn as one line; undefined for other composites. */
export function labelLine(node: Extract<ViewNode, { kind: 'composite' }>): string | undefined {
  if (node.direction !== 'row') return undefined;
  const texts = node.children.map((child) => (child.kind === 'label' ? child.text : undefined));
  return texts.every((text) => text !== undefined) ? texts.join('').replace(/\s+/g, ' ').trim() : undefined;
}

/** The question to ask before running a view action, if any (`confirm: true` asks with its label). */
export const confirmQuestion = (action: ViewAction): string | undefined =>
  action.confirm === true ? `${action.label}?` : action.confirm || undefined;
