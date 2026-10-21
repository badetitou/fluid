import { z } from 'zod';

// Building blocks shared by the view spec and by every widget schema: value
// formats, data bindings, table columns and the layout fields of a widget.

/**
 * A value-formatting hint used by table columns, descriptions and statistics.
 * `image` renders a URL as a picture, behind a URL check and a user click
 * (see apps/frontend/src/views/imageSafety.ts). `markdown` renders text as
 * Markdown (no raw HTML); `code` renders it as a highlighted code block.
 */
export const formatKindSchema = z.enum([
  'text',
  'number',
  'currency',
  'percent',
  'date',
  'datetime',
  'tag',
  'boolean',
  'image',
  'markdown',
  'code',
]);
export type FormatKind = z.infer<typeof formatKindSchema>;

/**
 * Reshapes a selected array before rendering.
 * - `derive` first adds per-row computed fields aggregating nested data, e.g.
 *   `{ as: "totalSpent", op: "sum", field: "accounts.transactions.amount" }` on
 *   customer rows. The new fields can then be grouped, sorted and displayed.
 * - `groupBy` collapses rows by a field and emits, per group, the group key plus
 *   the aggregates `count`, and (when `aggregate.field` is set) `sum`, `avg`,
 *   `min`, `max`. Charts then use e.g. `xField: "<groupBy>"`, `yField: "count"`.
 * - `sort` / `limit` apply after grouping (or directly on the array).
 */
export const transformSchema = z.object({
  derive: z
    .array(
      z.object({
        /** Name of the computed field added to each row. */
        as: z.string().min(1),
        op: z.enum(['count', 'sum', 'avg', 'min', 'max', 'first']),
        /** Dot path in the row, usually crossing a nested list. */
        field: z.string().optional(),
      }),
    )
    .optional(),
  groupBy: z.string().optional(),
  aggregate: z
    .object({
      field: z.string().min(1),
    })
    .optional(),
  sort: z
    .object({
      by: z.string().min(1),
      dir: z.enum(['asc', 'desc']).default('asc'),
    })
    .optional(),
  limit: z.number().int().positive().optional(),
});
export type Transform = z.infer<typeof transformSchema>;

/** Where a widget gets its data: a query key, a dot path into the result, and an optional transform. */
export const dataBindingSchema = z.object({
  /** Key into `ViewSpec.queries`. */
  query: z.string().min(1),
  /** Dot path into the query result, e.g. "accounts" or "customer.accounts". Omit to use the root. */
  path: z.string().optional(),
  transform: transformSchema.optional(),
});
export type DataBinding = z.infer<typeof dataBindingSchema>;

/** Navigation configuration: concept to navigate to and optional field for the ID parameter. */
export const linkToSchema = z.object({
  /** Target concept name. */
  concept: z.string().min(1),
  /** Dot path to the ID value (defaults to "id"). */
  idField: z.string().optional(),
});
export type LinkTo = z.infer<typeof linkToSchema>;

/** A table column definition. */
export const columnSchema = z.object({
  /** Dot path into each row, e.g. "iban" or "customer.fullName". */
  key: z.string().min(1),
  title: z.string().min(1).optional(),
  format: formatKindSchema.optional(),
  /** Currency code for `format: "currency"` (defaults to EUR). */
  currency: z.string().optional(),
  width: z.number().int().positive().optional(),
  linkTo: linkToSchema.optional(),
});
export type Column = z.infer<typeof columnSchema>;

/** Number of columns of the widget layout grid (see `widgetLayoutSchema`). */
export const GRID_COLUMNS = 12;

/**
 * Explicit placement of a widget on the view's layout grid, set by arranging
 * widgets with the mouse. `x`/`w` are in columns (out of `GRID_COLUMNS`), `y`/`h`
 * in grid rows. When any widget of a view has a layout, the view is rendered on
 * that grid; otherwise widgets flow by `span`.
 */
export const widgetLayoutSchema = z.object({
  x: z
    .number()
    .int()
    .min(0)
    .max(GRID_COLUMNS - 1),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(GRID_COLUMNS),
  h: z.number().int().min(1),
});
export type WidgetLayout = z.infer<typeof widgetLayoutSchema>;

// Fields shared by every widget. Spread into each discriminated member.
export const widgetBase = {
  /** Stable id, unique within the view. */
  id: z.string().min(1),
  title: z.string().optional(),
  /** Grid width on large screens, in Ant Design's 24-column system (default 24). */
  span: z.number().int().min(1).max(24).optional(),
  /** Pixel height (mostly relevant for charts). */
  height: z.number().int().positive().optional(),
  /** Explicit grid placement; takes precedence over `span`/`height` when set. */
  layout: widgetLayoutSchema.optional(),
};
