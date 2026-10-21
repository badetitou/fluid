/**
 * URLs of the dashboard / Miller view: `/d/<root>/<column>/<column>/…`.
 *
 * The root is a dashboard: the Concepts page (`@home`), a saved dashboard
 * (`~<id>`) or a concept column. Alone, it shows as a page; each following
 * segment is one more Miller column opened from a link, written `Concept` for
 * a work list and `Concept@<id>` for one item. Concept names are GraphQL
 * names, so the first `@` after one always starts the id.
 */

export const DASHBOARD_PREFIX = '/d';
export const HOME_SEGMENT = '@home';
/** Path of the Concepts page as a column, which its cards open columns after. */
export const HOME_PATH = `${DASHBOARD_PREFIX}/${HOME_SEGMENT}`;

/** A column bound to a concept: its work list, or one item when `itemId` is set. */
export interface ColumnRef {
  concept: string;
  itemId?: string;
}

export type RootRef = { kind: 'home' } | { kind: 'dashboard'; id: string } | ({ kind: 'column' } & ColumnRef);

export function columnSegment({ concept, itemId }: ColumnRef): string {
  return itemId === undefined ? concept : `${concept}@${encodeURIComponent(itemId)}`;
}

/** Read a (router-decoded) column segment; a leading `@` belongs to the name (e.g. `@graph`). */
export function parseColumnSegment(segment: string): ColumnRef {
  const at = segment.indexOf('@', 1);
  return at === -1 ? { concept: segment } : { concept: segment.slice(0, at), itemId: segment.slice(at + 1) };
}

export function rootSegment(root: RootRef): string {
  if (root.kind === 'home') return HOME_SEGMENT;
  if (root.kind === 'dashboard') return `~${root.id}`;
  return columnSegment(root);
}

export function parseRootSegment(segment: string): RootRef {
  if (segment === HOME_SEGMENT) return { kind: 'home' };
  if (segment.startsWith('~')) return { kind: 'dashboard', id: segment.slice(1) };
  return { kind: 'column', ...parseColumnSegment(segment) };
}

/** Path opening a dashboard on its own, as a page. */
export function rootPath(root: RootRef): string {
  return root.kind === 'home' ? '/' : `${DASHBOARD_PREFIX}/${rootSegment(root)}`;
}

/** The splat after `/d/`: the root (home when empty) and the columns opened after it. */
export function parseDashboardSplat(splat: string): { root: RootRef; rootSegment: string; stack: ColumnRef[] } {
  const [first, ...rest] = splat.split('/').filter(Boolean);
  const segment = first ?? HOME_SEGMENT;
  return { root: parseRootSegment(segment), rootSegment: segment, stack: rest.map(parseColumnSegment) };
}

/** The root a pathname shows, or null outside the dashboards (settings…). */
export function rootOfPathname(pathname: string): RootRef | null {
  if (pathname === '/') return { kind: 'home' };
  const match = pathname.match(/^\/d\/([^/]+)/);
  if (!match) return null;
  let segment = match[1];
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // Keep a malformed segment as is.
  }
  return parseRootSegment(segment);
}

/** Path of the column `ref` opened right after the column at `base`. */
export function appendColumn(base: string, ref: ColumnRef): string {
  return `${base.replace(/\/$/, '')}/${columnSegment(ref)}`;
}
