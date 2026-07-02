import type { ViewSpec, ViewScope } from '@fluid/shared';

export type { ViewScope };

/** The kind of column a perspective is being shown in. */
export type ColumnKind = ViewScope;

/**
 * Determine the concrete target a view is associated with.
 *
 * A view's explicit `scope` always wins. For legacy views saved before the
 * scope field existed, fall back to a heuristic: a view is "detail" when it
 * reads from the concept's by-id query, otherwise it is a "list".
 */
export function getViewScope(spec: ViewSpec, byIdField?: string): ViewScope {
  if (spec.scope === 'list' || spec.scope === 'detail') return spec.scope;
  if (byIdField && spec.queries[byIdField]) return 'detail';
  return 'list';
}

/** Whether a view belongs in a column of the given kind (list vs detail). */
export function isViewForColumn(spec: ViewSpec, columnKind: ColumnKind, byIdField?: string): boolean {
  return getViewScope(spec, byIdField) === columnKind;
}

/** Return a copy of the spec associated with the given scope. */
export function withScope(spec: ViewSpec, scope: ViewScope): ViewSpec {
  return { ...spec, scope };
}
