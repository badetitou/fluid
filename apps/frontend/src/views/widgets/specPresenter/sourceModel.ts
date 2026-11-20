import type { z } from 'zod';
import {
  describeIssues,
  objectViewsResponseSchema,
  viewActionResultSchema,
  viewItemsResponseSchema,
  OPEN_VIEWS_QUERIES,
  type ObjectViewsResponse,
  type ViewActionResult,
  type ViewRef,
} from '@fluid/shared';
import type { DataSource } from '../../plugin-api/dataSources';
import type { ItemsLoader } from './itemsModel';

// The widget's way back to its provider: the data source its query names, with
// that query's variables (`{ id, view }`), for the queries of
// `OPEN_VIEWS_QUERIES`. Answers are validated: they come from another tool.

/** One view of one object, as the data source serves it. */
export interface OpenViewSource {
  /** Runs the bound query again (to refresh the view); its raw answer. */
  reload: () => Promise<unknown>;
  /** Pages the items of a list or tree of this view. */
  items: ItemsLoader;
  /** Runs one of this view's actions. */
  action: (id: string) => Promise<ViewActionResult>;
  /** The views of another object (for a `forward` node). */
  views: (ref: ViewRef) => Promise<ObjectViewsResponse>;
  /** The same source, on the view `key` of the object `ref`. */
  forward: (ref: ViewRef, key: string) => OpenViewSource;
}

function checked<T>(schema: z.ZodType<T>, what: string): (answer: unknown) => T {
  return (answer) => {
    const parsed = schema.safeParse(answer);
    if (!parsed.success) throw new Error(`The view provider sent unexpected ${what}:\n${describeIssues(parsed.error)}`);
    return parsed.data;
  };
}

/** The source of the view that `query` with `variables` loads from `source`. */
export function openViewSource(source: DataSource, query: string, variables: Record<string, unknown>): OpenViewSource {
  const run = (name: string, extra: Record<string, unknown>) => source.run(name, { ...variables, ...extra });
  return {
    reload: () => source.run(query, variables),
    items: (path, offset, limit) =>
      run(OPEN_VIEWS_QUERIES.items, { path, offset, ...(limit !== undefined ? { limit } : {}) }).then(
        checked(viewItemsResponseSchema, 'items'),
      ),
    action: (id) => run(OPEN_VIEWS_QUERIES.action, { action: id }).then(checked(viewActionResultSchema, 'an action result')),
    views: (ref) => run(OPEN_VIEWS_QUERIES.views, { id: ref.id }).then(checked(objectViewsResponseSchema, 'views')),
    forward: (ref, key) => openViewSource(source, OPEN_VIEWS_QUERIES.view, { ...variables, id: ref.id, view: key }),
  };
}
