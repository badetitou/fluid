import { isRecord, type DataBinding, type QuerySpec, type Widget, type CoreWidgetType } from '@fluid/shared';
import { asRows, resolveBinding } from '../../views/data';
import { defaultWidget, type SampleFields } from '../../views/widgets/defaults';

// Adding a widget from the catalog: where its data comes from, which fields it
// can use, and an id no other widget of the view has.

/** `type`, or `type-2`, `type-3`… whichever no widget of the view uses yet. */
export function uniqueWidgetId(type: CoreWidgetType, widgets: Widget[]): string {
  const taken = new Set(widgets.map((w) => w.id));
  let id: string = type;
  for (let n = 2; taken.has(id); n++) id = `${type}-${n}`;
  return id;
}


/** Dot paths, in a query result, that lead to lists (what a widget is usually bound to). */
export function arrayPaths(value: unknown, prefix = '', depth = 4): string[] {
  if (depth < 0) return [];
  if (Array.isArray(value)) {
    const nested = isRecord(value[0]) ? arrayPaths(value[0], prefix, depth - 1).filter((p) => p !== prefix) : [];
    return [prefix, ...nested].filter(Boolean);
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === '__typename' ? [] : arrayPaths(child, prefix ? `${prefix}.${key}` : key, depth - 1),
  );
}

/** Scalar fields found in the first rows of resolved data, as dot paths (nested objects included). */
export function sampleFields(data: unknown): SampleFields {
  const fields: SampleFields = { all: [], text: [], numeric: [] };
  const seen = new Set<string>();
  const visit = (row: Record<string, unknown>, prefix: string, depth: number) => {
    for (const [key, value] of Object.entries(row)) {
      if (key === '__typename') continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (isRecord(value)) {
        if (depth > 0) visit(value, path, depth - 1);
      } else if (!Array.isArray(value) && value !== null && value !== undefined && !seen.has(path)) {
        seen.add(path);
        fields.all.push(path);
        if (typeof value === 'string') fields.text.push(path);
        if (typeof value === 'number') fields.numeric.push(path);
      }
    }
  };
  for (const row of asRows(data).slice(0, 20)) if (isRecord(row)) visit(row, '', 1);
  return fields;
}

/** The binding of a new widget: the same data as the view's first widget, or its first query's first list. */
export function defaultBinding(widgets: Widget[], queries: Record<string, QuerySpec>, results: Record<string, unknown>): DataBinding {
  const first = widgets[0]?.data;
  if (first) return { query: first.query, ...(first.path ? { path: first.path } : {}) };
  const query = Object.keys(queries)[0] ?? 'main';
  const path = arrayPaths(results[query])[0];
  return path ? { query, path } : { query };
}

interface NewWidgetContext {
  widgets: Widget[];
  queries: Record<string, QuerySpec>;
  results: Record<string, unknown>;
  title: string;
}

/** A widget of `type` to add to a view, bound to the view's data and set up from a peek at it. */
export function newWidget(type: CoreWidgetType, { widgets, queries, results, title }: NewWidgetContext): Widget {
  const data = defaultBinding(widgets, queries, results);
  const fields = sampleFields(resolveBinding(data, results));
  return defaultWidget(type, { id: uniqueWidgetId(type, widgets), title, data, fields });
}
