import { z } from 'zod';

// -----------------------------------------------------------------------------
// Fluid view spec (v1)
// -----------------------------------------------------------------------------
// A "view" is a declarative dashboard bound to a single concept (a GraphQL
// object type). It is a plain JSON document so it can be hand-written, generated
// by an LLM, persisted, and re-rendered later without the LLM.
//
// Shape (high level):
//   {
//     version: 1,
//     concept: "Account",
//     title: "Accounts overview",
//     queries: { <key>: { query: "<GraphQL document>", variables?: {...} } },
//     widgets: [ { type, title, span, data: { query, path, transform }, ...opts } ]
//   }
//
// Widgets read their data from a named query result via a dot `path`, then an
// optional `transform` (group / aggregate / sort / limit) reshapes it before it
// is rendered. This keeps the data-fetching declarative and cache-friendly.
// -----------------------------------------------------------------------------

export const VIEW_SPEC_VERSION = 1;

/** A value-formatting hint used by table columns, descriptions and statistics. */
export const formatKindSchema = z.enum([
  'text',
  'number',
  'currency',
  'percent',
  'date',
  'datetime',
  'tag',
  'boolean',
]);
export type FormatKind = z.infer<typeof formatKindSchema>;

/** A named GraphQL query a widget can pull data from. */
export const querySpecSchema = z.object({
  /** A GraphQL document, e.g. `query($take: Int) { accounts(take: $take) { id } }`. */
  query: z.string().min(1),
  /** Static variables passed to the query. */
  variables: z.record(z.unknown()).optional(),
});
export type QuerySpec = z.infer<typeof querySpecSchema>;

/**
 * Reshapes a selected array before rendering.
 * - `groupBy` collapses rows by a field and emits, per group, the group key plus
 *   the aggregates `count`, and (when `aggregate.field` is set) `sum`, `avg`,
 *   `min`, `max`. Charts then use e.g. `xField: "<groupBy>"`, `yField: "count"`.
 * - `sort` / `limit` apply after grouping (or directly on the array).
 */
export const transformSchema = z.object({
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

/** A single aggregation used by the statistic widget. */
export const aggregationSchema = z.object({
  op: z.enum(['count', 'sum', 'avg', 'min', 'max', 'first']),
  /** Dot path of the numeric field. Required for sum/avg/min/max/first (not for count). */
  field: z.string().optional(),
});
export type Aggregation = z.infer<typeof aggregationSchema>;

/** A table column definition. */
export const columnSchema = z.object({
  /** Dot path into each row, e.g. "iban" or "customer.fullName". */
  key: z.string().min(1),
  title: z.string().min(1),
  format: formatKindSchema.optional(),
  /** Currency code for `format: "currency"` (defaults to EUR). */
  currency: z.string().optional(),
  width: z.number().int().positive().optional(),
});
export type Column = z.infer<typeof columnSchema>;

// Fields shared by every widget. Spread into each discriminated member.
const widgetBase = {
  /** Stable id, unique within the view. */
  id: z.string().min(1),
  title: z.string().optional(),
  /** Grid width on large screens, in Ant Design's 24-column system (default 24). */
  span: z.number().int().min(1).max(24).optional(),
  /** Pixel height (mostly relevant for charts). */
  height: z.number().int().positive().optional(),
};

export const tableWidgetSchema = z.object({
  type: z.literal('table'),
  ...widgetBase,
  data: dataBindingSchema,
  /** Columns to render. If omitted, they are inferred from the first row's keys. */
  columns: z.array(columnSchema).optional(),
  pageSize: z.number().int().positive().optional(),
});
export type TableWidget = z.infer<typeof tableWidgetSchema>;

export const statisticWidgetSchema = z.object({
  type: z.literal('statistic'),
  ...widgetBase,
  data: dataBindingSchema,
  value: aggregationSchema,
  format: z.enum(['number', 'currency', 'percent']).optional(),
  currency: z.string().optional(),
  precision: z.number().int().min(0).max(6).optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});
export type StatisticWidget = z.infer<typeof statisticWidgetSchema>;

export const descriptionsWidgetSchema = z.object({
  type: z.literal('descriptions'),
  ...widgetBase,
  /** Binds to a single object (or the first element of an array). */
  data: dataBindingSchema,
  items: z.array(
    z.object({
      label: z.string().min(1),
      key: z.string().min(1),
      format: formatKindSchema.optional(),
      currency: z.string().optional(),
    }),
  ),
  columns: z.number().int().min(1).max(4).optional(),
});
export type DescriptionsWidget = z.infer<typeof descriptionsWidgetSchema>;

// Charts share x/y/series fields. After a `groupBy` transform the available
// fields are the group key (named after `groupBy`) plus count/sum/avg/min/max.
const cartesianChart = {
  ...widgetBase,
  data: dataBindingSchema,
  xField: z.string().min(1),
  yField: z.string().min(1),
  /** Optional category field that splits the data into colored series. */
  colorField: z.string().optional(),
};

export const lineWidgetSchema = z.object({
  type: z.literal('line'),
  ...cartesianChart,
});
export type LineWidget = z.infer<typeof lineWidgetSchema>;

export const barWidgetSchema = z.object({
  type: z.literal('bar'),
  ...cartesianChart,
});
export type BarWidget = z.infer<typeof barWidgetSchema>;

export const areaWidgetSchema = z.object({
  type: z.literal('area'),
  ...cartesianChart,
});
export type AreaWidget = z.infer<typeof areaWidgetSchema>;

export const pieWidgetSchema = z.object({
  type: z.literal('pie'),
  ...widgetBase,
  data: dataBindingSchema,
  /** Numeric field for the slice size, e.g. "count" or "sum". */
  angleField: z.string().min(1),
  /** Category field for the slice color/label. */
  colorField: z.string().min(1),
});
export type PieWidget = z.infer<typeof pieWidgetSchema>;

export const widgetSchema = z.discriminatedUnion('type', [
  tableWidgetSchema,
  statisticWidgetSchema,
  descriptionsWidgetSchema,
  lineWidgetSchema,
  barWidgetSchema,
  areaWidgetSchema,
  pieWidgetSchema,
]);
export type Widget = z.infer<typeof widgetSchema>;
export type WidgetType = Widget['type'];

export const WIDGET_TYPES = [
  'table',
  'statistic',
  'descriptions',
  'line',
  'bar',
  'area',
  'pie',
] as const;

export const viewSpecSchema = z.object({
  version: z.literal(VIEW_SPEC_VERSION).default(VIEW_SPEC_VERSION),
  /** Stable identifier of the view. */
  id: z.string().min(1),
  /** Concept (GraphQL object type) this view is bound to. */
  concept: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  /** Named GraphQL queries widgets pull their data from. */
  queries: z.record(querySpecSchema),
  widgets: z.array(widgetSchema),
});
export type ViewSpec = z.infer<typeof viewSpecSchema>;

/** Parse and validate an unknown value as a ViewSpec (throws on error). */
export function parseViewSpec(input: unknown): ViewSpec {
  return viewSpecSchema.parse(input);
}

/** Safe variant: returns a zod SafeParseReturnType. */
export function safeParseViewSpec(input: unknown) {
  return viewSpecSchema.safeParse(input);
}
