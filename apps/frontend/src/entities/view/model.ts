import type { ViewSpec, Widget } from '@fluid/shared';
import type { BuiltPerspective } from '../plugin';
import { getViewScope, type ColumnKind } from '../../views/viewScope';
import type { ViewEntry } from './useViews';

/** A fresh, unique id for a view created from a concept's column. */
export function newViewId(concept: string, now = Date.now()): string {
  return `${concept.toLowerCase()}-view-${now.toString(36)}`;
}

/** Prefill of the JSON editor: a view, its title and default flag. */
export interface ViewDraft {
  title: string;
  spec: ViewSpec;
  isDefault: boolean;
  /** Present when editing an existing saved view. */
  editingId?: string;
}

/** Prefill for a brand-new perspective: clone `from` with a fresh id, or start empty. */
export function newViewDraft(concept: string, from: ViewSpec | undefined, scope: ColumnKind): ViewDraft {
  const id = newViewId(concept);
  const spec: ViewSpec = from
    ? { ...from, id, concept, scope }
    : { version: 1, id, concept, scope, title: `${concept} view`, queries: {}, widgets: [] };
  return { title: `${concept} view`, spec, isDefault: false };
}

/**
 * A blank view being created in a column, shown until one of the editors saves
 * it. It starts with `queries` (the column's data) so widgets added by hand have something to show.
 */
export function draftViewEntry(
  concept: string,
  scope: ColumnKind,
  queries: ViewSpec['queries'] = {},
  now = Date.now(),
): ViewEntry {
  const id = newViewId(concept, now);
  const spec: ViewSpec = { version: 1, id, concept, scope, title: 'New view', queries, widgets: [] };
  return { key: `draft:${id}`, title: spec.title, source: 'draft', spec };
}

/**
 * Prefill of the JSON editor from a view being edited in place (layout editor):
 * a saved view is updated, any other is saved as a new one.
 */
export function editedViewDraft(entry: ViewEntry, spec: ViewSpec, scope: ColumnKind): ViewDraft {
  if (entry.saved) return { title: spec.title, spec, isDefault: entry.saved.isDefault, editingId: entry.saved.id };
  return { ...newViewDraft(spec.concept, spec, scope), title: spec.title };
}

/** Prefill for editing a saved perspective. */
export function savedViewDraft(entry: ViewEntry): ViewDraft | null {
  if (!entry.saved) return null;
  const { title, spec, isDefault, id } = entry.saved;
  return { title, spec, isDefault, editingId: id };
}

/**
 * The view builders' perspectives as column entries: the first one a builder
 * made the default of this kind of column, and the others in order.
 */
export function perspectiveEntries(
  perspectives: BuiltPerspective[],
  columnKind: ColumnKind,
): { preferred?: ViewEntry; others: ViewEntry[] } {
  const entries = perspectives.map<ViewEntry>(({ key, title, origin, spec, defaultFor, builder }) => ({
    key,
    title,
    source: origin,
    spec,
    defaultFor,
    builder,
  }));
  const preferred = entries.find((e) => e.defaultFor === columnKind);
  return { preferred, others: entries.filter((e) => e !== preferred) };
}

/**
 * Perspectives shown in a column: those whose scope matches the column kind,
 * preceded by the auto detail perspective for a drilled-in (detail) column.
 */
export function columnEntries(
  entries: ViewEntry[],
  columnKind: ColumnKind,
  byIdField: string | undefined,
  detailEntry: ViewEntry | null,
): ViewEntry[] {
  const matches = entries.filter((e) => getViewScope(e.spec, byIdField) === columnKind);
  return detailEntry ? [detailEntry, ...matches] : matches;
}

/**
 * The perspective to show: the user's pick when still listed, else the column
 * default (the detail perspective in a detail column, the saved default in a
 * list column) when listed, else the first one.
 */
export function resolveActiveKey(
  entries: ViewEntry[],
  picked: string | undefined,
  preferred: string | undefined,
): string | undefined {
  const has = (key: string | undefined) => key !== undefined && entries.some((e) => e.key === key);
  if (has(picked)) return picked;
  return has(preferred) ? preferred : entries[0]?.key;
}

/** Whether a GraphQL document declares an `$id` variable. */
const DECLARES_ID = /\$id\s*:/;

/** Numeric GraphQL variables must receive JSON numbers, unlike ID variables. */
function itemIdForQuery(query: string, itemId: string): string | number {
  const type = /\$id\s*:\s*(Float|Int)\b/.exec(query)?.[1];
  if (!type) return itemId;
  const value = Number(itemId);
  return Number.isFinite(value) && (type !== 'Int' || Number.isInteger(value)) ? value : itemId;
}

/**
 * Inject a drilled-in item id into the queries that read it: the by-id query,
 * and any other query declaring an `$id` variable it was not given. Views that
 * read neither are returned untouched (avoids firing an unused query for list views).
 */
export function injectItemId(spec: ViewSpec, byIdField: string | undefined, itemId: string | undefined): ViewSpec {
  if (!itemId) return spec;
  const reads = (key: string) => {
    const query = spec.queries[key];
    return key === byIdField || (DECLARES_ID.test(query.query) && query.variables?.id === undefined);
  };
  const keys = Object.keys(spec.queries).filter(reads);
  if (keys.length === 0) return spec;
  const queries = { ...spec.queries };
  for (const key of keys) {
    queries[key] = {
      ...queries[key],
      variables: { ...queries[key].variables, id: itemIdForQuery(queries[key].query, itemId) },
    };
  }
  return { ...spec, queries };
}

/** Widgets the new spec kept (same id) stay where they were arranged in `previous`. */
export function preserveLayouts(widgets: Widget[], previous: Widget[]): Widget[] {
  const layouts = new Map(previous.map((w) => [w.id, w.layout]));
  return widgets.map((w) => {
    const layout = layouts.get(w.id);
    return w.layout || !layout ? w : { ...w, layout };
  });
}
