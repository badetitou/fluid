import { z } from 'zod';
import { GRAPH_CONCEPT, isGraphConcept } from '@fluid/shared';
import { DASHBOARD_PREFIX, rootOfPathname, rootPath } from '../../navigation/millerPath';

/**
 * A saved dashboard: one column — a concept's work list or one of its items —
 * shown on a given perspective. It opens as a page; following a link in it
 * turns the page into a Miller view with the dashboard as first column.
 */
export interface Dashboard {
  id: string;
  title: string;
  /** Concept of the column (the graph pseudo-concept for graph dashboards). */
  concept: string;
  /** Item shown, for a dashboard promoted from a detail column. */
  itemId?: string;
  /** Perspective (view key) shown in the column. */
  perspective?: string;
}

/** Path of the whole-graph column, where new graph dashboards are created. */
export const GRAPH_PATH = `${DASHBOARD_PREFIX}/${GRAPH_CONCEPT}`;

export function dashboardHref(dashboard: Pick<Dashboard, 'id'>): string {
  return rootPath({ kind: 'dashboard', id: dashboard.id });
}

/**
 * What a link asks the column at `path` to do once opened: open the assistant
 * to create a perspective. Carried in the router's navigation state, so it is
 * validated when read back.
 */
const preselectSchema = z.object({ path: z.string(), assistant: z.boolean().optional() });
export type Preselect = z.infer<typeof preselectSchema>;

const navStateSchema = z.object({ preselect: preselectSchema });

/** Router navigation state that opens the graph column with the assistant ready. */
export function newGraphDashboardNavState() {
  return { preselect: { path: GRAPH_PATH, assistant: true } };
}

/** The preselection carried by a location's state, if any. */
export function readPreselect(state: unknown): Preselect | null {
  const parsed = navStateSchema.safeParse(state);
  return parsed.success ? parsed.data.preselect : null;
}

export interface ColumnToPromote {
  concept: string;
  itemId?: string;
  perspective?: { key: string; title: string };
}

/** The dashboard a column is promoted to: same concept, item and perspective. */
export function dashboardFromColumn(column: ColumnToPromote, now = Date.now()): Dashboard {
  const base = column.perspective?.title ?? column.concept;
  return {
    id: now.toString(36),
    title: column.itemId ? `${base} · ${column.itemId}` : base,
    concept: column.concept,
    ...(column.itemId !== undefined ? { itemId: column.itemId } : {}),
    ...(column.perspective ? { perspective: column.perspective.key } : {}),
  };
}

const sameColumn = (a: Dashboard, b: Dashboard) =>
  a.concept === b.concept && a.itemId === b.itemId && a.perspective === b.perspective;

/** Append a dashboard, or return the existing one showing the same column. */
export function addDashboard(list: Dashboard[], dashboard: Dashboard): { list: Dashboard[]; dashboard: Dashboard } {
  const existing = list.find((d) => sameColumn(d, dashboard));
  return existing ? { list, dashboard: existing } : { list: [...list, dashboard], dashboard };
}

export function removeDashboard(list: Dashboard[], id: string): Dashboard[] {
  return list.filter((d) => d.id !== id);
}

/** Rename a dashboard; a blank title keeps the current one. */
export function renameDashboard(list: Dashboard[], id: string, title: string): Dashboard[] {
  const trimmed = title.trim();
  if (!trimmed) return list;
  return list.map((d) => (d.id === id ? { ...d, title: trimmed } : d));
}

/** Drop the dashboards showing a perspective that no longer exists. */
export function forgetPerspective(list: Dashboard[], perspective: string): Dashboard[] {
  return list.filter((d) => d.perspective !== perspective);
}

export function isGraphDashboard(dashboard: Dashboard): boolean {
  return isGraphConcept(dashboard.concept);
}

/** Key of the bar entry to highlight: the dashboard the page starts from. */
export function selectedBarKey(pathname: string): string {
  const root = rootOfPathname(pathname);
  if (!root) return '';
  if (root.kind === 'home') return 'home';
  if (root.kind === 'dashboard') return `dashboard:${root.id}`;
  return root.itemId === undefined ? `concept:${root.concept}` : '';
}
