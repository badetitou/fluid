import type { ViewSpec, Widget } from '@fluid/shared';
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

/** Prefill for editing a saved perspective. */
export function savedViewDraft(entry: ViewEntry): ViewDraft | null {
  if (!entry.saved) return null;
  const { title, spec, isDefault, id } = entry.saved;
  return { title, spec, isDefault, editingId: id };
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

/**
 * Inject a drilled-in item id into the by-id query, but only when the view
 * actually reads from it (avoids firing an unused query for list views).
 */
export function injectItemId(spec: ViewSpec, byIdField: string | undefined, itemId: string | undefined): ViewSpec {
  if (!itemId || !byIdField || !spec.queries[byIdField]) return spec;
  const query = spec.queries[byIdField];
  return {
    ...spec,
    queries: { ...spec.queries, [byIdField]: { ...query, variables: { ...query.variables, id: itemId } } },
  };
}

/** Widgets the new spec kept (same id) stay where they were arranged in `previous`. */
export function preserveLayouts(widgets: Widget[], previous: Widget[]): Widget[] {
  const layouts = new Map(previous.map((w) => [w.id, w.layout]));
  return widgets.map((w) => {
    const layout = layouts.get(w.id);
    return w.layout || !layout ? w : { ...w, layout };
  });
}
