import {
  specFluidNodeSchema,
  type SpecFluidCell,
  type SpecFluidNode,
  type SpecFluidRef,
  type SpecFluidTreeNode,
} from '@fluid/shared';

// The pure half of the Spec-Fluid presenter: validating the document, keying
// its rows, sorting cells and deciding which entities can be opened.

export type ParsedSpecNode = { node: SpecFluidNode; reason?: undefined } | { node?: undefined; reason: string };

/** The Spec-Fluid node of `data`, or why there is none to draw. */
export function parseSpecNode(data: unknown): ParsedSpecNode {
  if (data === undefined || data === null) {
    return { reason: 'No inspector tab to show: the data source returned nothing for this binding.' };
  }
  const parsed = specFluidNodeSchema.safeParse(data);
  if (parsed.success) return { node: parsed.data };
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? ` (at ${issue.path.join('.')})` : '';
  return { reason: `Not a Spec-Fluid document${where}: ${issue?.message ?? 'invalid'}. Bind "data" to the tab's "root".` };
}

/** A stable key of an entity, to compare selections. */
export const refKey = (ref: SpecFluidRef): string => `${ref.type ?? ''}#${ref.id}`;

/**
 * The concept opening `ref` in a new column: its type, when it has one and the
 * source can open it (`openable` null: unknown, every type is allowed).
 */
export function openableConcept(ref: SpecFluidRef | undefined, openable: ReadonlySet<string> | null): string | undefined {
  if (!ref?.type) return undefined;
  return openable === null || openable.has(ref.type) ? ref.type : undefined;
}

/** A table row as antd draws it: its cells, its entity and a key. */
export interface SpecRow {
  key: string;
  cells: SpecFluidCell[];
  ref?: SpecFluidRef;
  /** Pharo has more children than it sent. */
  hasMore?: boolean;
  /** Absent on leaves, so antd draws no expand button. */
  children?: SpecRow[];
}

/** The entity a row stands for: its own, else the first one of its cells. */
export const rowRef = (row: Pick<SpecRow, 'cells' | 'ref'>): SpecFluidRef | undefined =>
  row.ref ?? row.cells.find((cell) => cell.ref)?.ref;

/**
 * The cells of a row naming an entity: when none links anywhere, the first one
 * links to the row's entity (Pharo puts the entity on the row, e.g. FAST trees).
 */
export function linkedCells(cells: SpecFluidCell[], ref: SpecFluidRef | undefined): SpecFluidCell[] {
  if (!ref || cells.length === 0 || cells.some((cell) => cell.ref)) return cells;
  return [{ ...cells[0], ref }, ...cells.slice(1)];
}

/** The rows of a table node, keyed by position. */
export function tableRows(rows: { cells: SpecFluidCell[]; ref?: SpecFluidRef }[]): SpecRow[] {
  return rows.map((row, index) => ({ key: String(index), cells: linkedCells(row.cells, row.ref), ref: row.ref }));
}

/** The roots of a tree node as nested rows, keyed by their path ("0.2.1"). */
export function treeRows(nodes: SpecFluidTreeNode[], prefix = ''): SpecRow[] {
  return nodes.map((node, index) => {
    const key = prefix ? `${prefix}.${index}` : String(index);
    const children = node.children?.length ? treeRows(node.children, key) : undefined;
    return { key, cells: linkedCells(node.cells, node.ref), ref: node.ref, hasMore: node.hasMore, children };
  });
}

/** Keys of the rows unfolded at first: the roots having children. */
export const rootKeys = (rows: SpecRow[]): string[] => rows.filter((row) => row.children).map((row) => row.key);

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

/** The tab key of the page a notebook opens on: Pharo's selected page, else the first one. */
export function openPageKey(pageCount: number, selected: number | undefined): string {
  return String(selected !== undefined && selected < pageCount ? selected : 0);
}
