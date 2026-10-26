import type { PageFocus } from '../../entities/plugin';
import {
  appendColumn,
  columnSegment,
  DASHBOARD_PREFIX,
  parseDashboardSplat,
} from '../../navigation/millerPath';

/**
 * The column a page is about: the rightmost column of a Miller path
 * (`/d/<root>/<column>/…`), when it is bound to a concept. None on the
 * Concepts page, a saved dashboard alone or outside the dashboards.
 */
export function pageFocus(pathname: string): PageFocus | undefined {
  const prefix = `${DASHBOARD_PREFIX}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const { root, rootSegment, stack } = parseDashboardSplat(
    safeDecode(pathname.slice(prefix.length)),
  );
  const last = stack.at(-1);
  if (last) {
    const base = stack
      .slice(0, -1)
      .reduce((path, ref) => appendColumn(path, ref), `${prefix}${rootSegment}`);
    return { ...last, path: appendColumn(base, last) };
  }
  if (root.kind !== 'column') return undefined;
  return { concept: root.concept, itemId: root.itemId, path: `${prefix}${columnSegment(root)}` };
}

function safeDecode(splat: string): string {
  return splat
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');
}
