/** One drill-in step of the Miller path: a concept and the item opened in it. */
export interface NavigationNode {
  conceptName: string;
  itemId: string;
}

/** One column of the Miller view. */
export interface ColumnConfig {
  conceptName: string;
  /** Present for drill-in (detail) columns. */
  itemId?: string;
  /** Miller path of this column; links inside it open the next column after it. Unique per column. */
  path: string;
  /** Path of the column before it, which closing this one goes back to. */
  parentPath?: string;
}

/** Parse the splat of `/miller/:root/:concept/:itemId/…` into the root concept and its drill-in steps. */
export function parseMillerPath(splat: string): { root: string | undefined; stack: NavigationNode[] } {
  const parts = splat.split('/').filter(Boolean);
  const stack: NavigationNode[] = [];
  for (let i = 1; i < parts.length - 1; i += 2) {
    stack.push({ conceptName: parts[i], itemId: parts[i + 1] });
  }
  return { root: parts[0], stack };
}

/** The root work-list column followed by one detail column per drill-in step. */
export function buildColumns(root: string, stack: NavigationNode[]): ColumnConfig[] {
  const columns: ColumnConfig[] = [{ conceptName: root, path: `/miller/${root}` }];
  for (const nav of stack) {
    const parentPath = columns[columns.length - 1].path;
    columns.push({
      conceptName: nav.conceptName,
      itemId: nav.itemId,
      path: `${parentPath}/${nav.conceptName}/${encodeURIComponent(nav.itemId)}`,
      parentPath,
    });
  }
  return columns;
}

export function columnTitle({ conceptName, itemId }: Pick<ColumnConfig, 'conceptName' | 'itemId'>): string {
  return itemId ? `${conceptName}: ${itemId}` : `${conceptName} (work list)`;
}

export function columnSubtitle(conceptName: string): string {
  return `Entity Type: ${conceptName}`;
}
