import { isGraphConcept } from '@fluid/shared';
import type { Dashboard } from '../../entities/dashboard';
import { DASHBOARD_PREFIX, appendColumn, type ColumnRef, type RootRef } from '../../navigation/millerPath';

/** What the first column shows: the Concepts page, or a concept column (possibly a saved dashboard). */
export type RootColumn =
  | { kind: 'home' }
  | { kind: 'concept'; conceptName: string; itemId?: string; perspective?: string; title?: string };

/** One column of the view. */
export interface ColumnConfig {
  kind: 'home' | 'concept';
  conceptName: string;
  /** Present for detail columns. */
  itemId?: string;
  /** Perspective shown first (a saved dashboard's). */
  perspective?: string;
  /** Overrides the generated title (a saved dashboard's name). */
  title?: string;
  /** Path of this column; links inside it open the next column after it. Unique per column. */
  path: string;
  /** Path of the column before it, which closing this one goes back to. */
  parentPath?: string;
  /**
   * Position and shape of the column: its index, concept and whether it shows a
   * work list or one item. Navigating to another item of the same concept at the
   * same position keeps the slot, so the column updates in place instead of
   * being rebuilt, and its last perspective is remembered under it.
   */
  slot: string;
}

/** The slot of a column at `index` (see `ColumnConfig.slot`). */
export function columnSlot(index: number, column: Pick<ColumnConfig, 'kind' | 'conceptName' | 'itemId' | 'perspective'>): string {
  if (column.kind === 'home') return `${index}:home`;
  const shape = column.itemId === undefined ? 'list' : 'item';
  // A saved dashboard opens on its own perspective: another one is another column.
  const perspective = column.perspective === undefined ? '' : `:${column.perspective}`;
  return `${index}:${column.conceptName}:${shape}${perspective}`;
}

/** The first column a root opens, or null for a saved dashboard that no longer exists. */
export function resolveRoot(root: RootRef, find: (id: string) => Dashboard | undefined): RootColumn | null {
  if (root.kind === 'home') return root;
  if (root.kind === 'column') return { kind: 'concept', conceptName: root.concept, itemId: root.itemId };
  const dashboard = find(root.id);
  if (!dashboard) return null;
  const { concept, itemId, perspective, title } = dashboard;
  return { kind: 'concept', conceptName: concept, itemId, perspective, title };
}

/** The root column followed by one column per link followed from it. */
export function buildColumns(rootSegment: string, root: RootColumn, stack: ColumnRef[]): ColumnConfig[] {
  const path = `${DASHBOARD_PREFIX}/${rootSegment}`;
  const first = root.kind === 'home' ? { kind: 'home' as const, conceptName: '' } : root;
  const columns: ColumnConfig[] = [{ ...first, path, slot: columnSlot(0, first) }];
  for (const ref of stack) {
    const parentPath = columns[columns.length - 1].path;
    const column = { kind: 'concept' as const, conceptName: ref.concept, itemId: ref.itemId };
    columns.push({ ...column, path: appendColumn(parentPath, ref), parentPath, slot: columnSlot(columns.length, column) });
  }
  return columns;
}

/**
 * `next`, reusing the column objects of `prev` that did not change, so the
 * memoised columns left of a navigation do not re-render.
 */
export function reuseColumns(prev: ColumnConfig[], next: ColumnConfig[]): ColumnConfig[] {
  return next.map((column, i) => (prev[i] && sameColumn(prev[i], column) ? prev[i] : column));
}

function sameColumn(a: ColumnConfig, b: ColumnConfig): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ColumnConfig>;
  return [...keys].every((k) => a[k] === b[k]);
}

export function columnTitle({ kind, conceptName, itemId, title }: Pick<ColumnConfig, 'conceptName' | 'itemId'> & Partial<ColumnConfig>): string {
  if (kind === 'home') return 'Concepts';
  if (title) return title;
  if (isGraphConcept(conceptName)) return 'Graph dashboards';
  return itemId ? `${conceptName}: ${itemId}` : `${conceptName} (work list)`;
}

export function columnSubtitle(conceptName: string): string {
  if (isGraphConcept(conceptName)) return 'Queries across the whole graph';
  return `Entity Type: ${conceptName}`;
}
