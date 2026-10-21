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
  const columns: ColumnConfig[] = [root.kind === 'home' ? { kind: 'home', conceptName: '', path } : { ...root, path }];
  for (const ref of stack) {
    const parentPath = columns[columns.length - 1].path;
    columns.push({ kind: 'concept', conceptName: ref.concept, itemId: ref.itemId, path: appendColumn(parentPath, ref), parentPath });
  }
  return columns;
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
