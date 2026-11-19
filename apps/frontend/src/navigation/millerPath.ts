/**
 * URLs of the dashboard / Miller view: `/d/<root>/<column>/<column>/…`.
 *
 * The root is a dashboard: the Concepts page (`@home`), a saved dashboard
 * (`~<id>`) or a concept column. Alone, it shows as a page; each following
 * segment is one more Miller column opened from a link, written `Concept` for
 * a work list and `Concept@<id>` for one item. Concept names are GraphQL
 * names, so the first `@` after one always starts the id.
 *
 * Segments are read from `location.pathname`, which keeps the URL encoding.
 * React Router's splat param cannot be used: it decodes the path and turns an
 * item id's `%2F` into a real `/`, which would split it into bogus columns.
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

/** Decode a raw URL segment once; a malformed escape is left untouched. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Split a decoded segment; a leading `@` belongs to the name (e.g. `@graph`). */
function splitColumnSegment(segment: string): ColumnRef {
  const at = segment.indexOf('@', 1);
  return at === -1 ? { concept: segment } : { concept: segment.slice(0, at), itemId: segment.slice(at + 1) };
}

export function columnSegment({ concept, itemId }: ColumnRef): string {
  return itemId === undefined ? concept : `${concept}@${encodeURIComponent(itemId)}`;
}

/** Read a raw (still URL-encoded) column segment. */
export function parseColumnSegment(segment: string): ColumnRef {
  return splitColumnSegment(decodeSegment(segment));
}

/** Read a raw (still URL-encoded) root segment. */
export function parseRootSegment(segment: string): RootRef {
  const decoded = decodeSegment(segment);
  if (decoded === HOME_SEGMENT) return { kind: 'home' };
  if (decoded.startsWith('~')) return { kind: 'dashboard', id: decoded.slice(1) };
  return { kind: 'column', ...splitColumnSegment(decoded) };
}

export function rootSegment(root: RootRef): string {
  if (root.kind === 'home') return HOME_SEGMENT;
  if (root.kind === 'dashboard') return `~${root.id}`;
  return columnSegment(root);
}

/** Path opening a dashboard on its own, as a page. */
export function rootPath(root: RootRef): string {
  return root.kind === 'home' ? '/' : `${DASHBOARD_PREFIX}/${rootSegment(root)}`;
}

/** The raw splat after `/d/` in a pathname; empty for the Concepts page. */
export function splatFromPathname(pathname: string): string {
  return pathname.startsWith(`${DASHBOARD_PREFIX}/`) ? pathname.slice(DASHBOARD_PREFIX.length + 1) : '';
}

/**
 * The root (home when empty) and the columns opened after it. The splat must
 * still be encoded: separators are split before each segment is decoded, so
 * ids containing `/` stay in a single column.
 */
export function parseDashboardSplat(splat: string): { root: RootRef; rootSegment: string; stack: ColumnRef[] } {
  const [first, ...rest] = splat.split('/').filter(Boolean);
  const root = parseRootSegment(first ?? HOME_SEGMENT);
  // Rebuild the root so it uses the same encoding as the appended columns:
  // `buildColumns` reuses this segment to build the first column's path.
  return { root, rootSegment: rootSegment(root), stack: rest.map(parseColumnSegment) };
}

/** The root a pathname shows, or null outside the dashboards (settings…). */
export function rootOfPathname(pathname: string): RootRef | null {
  if (pathname === '/') return { kind: 'home' };
  const match = pathname.match(/^\/d\/([^/]+)/);
  return match ? parseRootSegment(match[1]) : null;
}

/** Path of the column `ref` opened right after the column at `base`. */
export function appendColumn(base: string, ref: ColumnRef): string {
  return `${base.replace(/\/$/, '')}/${columnSegment(ref)}`;
}
