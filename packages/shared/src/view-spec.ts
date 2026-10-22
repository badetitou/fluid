import { z } from 'zod';
import {
  columnSchema,
  dataBindingSchema,
  formatKindSchema,
  linkToSchema,
  widgetBase,
} from './widgets/common';
import { actionSpecSchema } from './actions/schema';
import { accordionWidgetFields } from './widgets/accordion';
import { codeWidgetSchema } from './widgets/code';
import { formWidgetSchema, rowActionSchema } from './widgets/form';
import { historyWidgetDraftSchema, historyWidgetSchema } from './widgets/history';
import { networkWidgetDraftSchema, networkWidgetSchema } from './widgets/network';
import { model3dWidgetSchema, scene3dWidgetSchema } from './widgets/model3d';
import { pluginWidgetDraftSchema, pluginWidgetSchema, type PluginWidget } from './widgets/plugin';
import { richTextWidgetSchema } from './widgets/richtext';
import { scatterWidgetSchema } from './widgets/scatter';
import { treeWidgetSchema } from './widgets/tree';

export * from './widgets/accordion';
export * from './widgets/code';
export * from './widgets/common';
export * from './widgets/coreDocs';
export * from './widgets/form';
export * from './widgets/history';
export * from './widgets/network';
export * from './widgets/model3d';
export * from './widgets/model3dExample';
export * from './widgets/plugin';
export * from './widgets/richtext';
export * from './widgets/scatter';
export * from './widgets/tree';

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


/** A named GraphQL query a widget can pull data from. */
export const querySpecSchema = z.object({
  /** A GraphQL document, e.g. `query($take: Int) { accounts(take: $take) { id } }`. */
  query: z.string().min(1),
  /** Static variables passed to the query. */
  variables: z.record(z.string(), z.unknown()).optional(),
});
export type QuerySpec = z.infer<typeof querySpecSchema>;


/** A single aggregation used by the statistic widget. */
export const aggregationSchema = z.object({
  op: z.enum(['count', 'sum', 'avg', 'min', 'max', 'first']),
  /** Dot path of the numeric field. Required for sum/avg/min/max/first (not for count). */
  field: z.string().optional(),
});
export type Aggregation = z.infer<typeof aggregationSchema>;


export const tableWidgetSchema = z.object({
  type: z.literal('table'),
  ...widgetBase,
  data: dataBindingSchema,
  /** Columns to render. If omitted, they are inferred from the first row's keys. */
  columns: z.array(columnSchema).optional(),
  pageSize: z.number().int().positive().optional(),
  /** Let the user sort rows by clicking a column header (default true). */
  sortable: z.boolean().optional(),
  /** Let the user filter rows by a column's values from its header (default true). */
  filterable: z.boolean().optional(),
  /** Buttons on each row running a view action on it (shown when the source accepts writes). */
  rowActions: z.array(rowActionSchema).optional(),
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
      linkTo: linkToSchema.optional(),
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

// The accordion nests widgets, accordions included: its type is written out so
// that the recursion goes through an explicit annotation, not through inference.
const accordionShellSchema = z.object({ type: z.literal('accordion'), ...accordionWidgetFields });
const nestedWidgetsSchema: z.ZodType<Widget[]> = z.lazy(() => z.array(widgetSchema));

/** Folding panels over a collection; `widgets` nests any widget, accordions included. */
export const accordionWidgetSchema = accordionShellSchema.extend({
  /** Widgets shown in an unfolded panel; they read its element with `data.query: "$item"`. */
  widgets: nestedWidgetsSchema,
});
export type AccordionWidget = z.infer<typeof accordionShellSchema> & { widgets: Widget[] };

const leafWidgetSchemas = [
  tableWidgetSchema,
  statisticWidgetSchema,
  descriptionsWidgetSchema,
  lineWidgetSchema,
  barWidgetSchema,
  areaWidgetSchema,
  pieWidgetSchema,
  treeWidgetSchema,
  richTextWidgetSchema,
  scatterWidgetSchema,
  historyWidgetSchema,
  codeWidgetSchema,
  networkWidgetSchema,
  formWidgetSchema,
  model3dWidgetSchema,
  scene3dWidgetSchema,
] as const;

/** A widget fluid ships; plugin widgets are typed `PluginWidget`. */
export type CoreWidget = z.infer<(typeof leafWidgetSchemas)[number]> | AccordionWidget;
export type Widget = CoreWidget | PluginWidget;
export const coreWidgetSchema = z.discriminatedUnion('type', [...leafWidgetSchemas, accordionWidgetSchema]);
/** Any widget: a built-in one, or a plugin's (`"<pluginId>/<name>"`, checked against the plugin catalog). */
export const widgetSchema = z.union([coreWidgetSchema, pluginWidgetSchema]);
export type CoreWidgetType = CoreWidget['type'];

/** Whether a widget is a built-in one (plugin widgets are typed `"<pluginId>/<name>"`). */
export const isCoreWidget = (widget: Widget): widget is CoreWidget => !widget.type.includes('/');
export type WidgetType = Widget['type'];

/** The built-in widget types. */
export const WIDGET_TYPES = [
  'table',
  'statistic',
  'descriptions',
  'line',
  'bar',
  'area',
  'pie',
  'tree',
  'richtext',
  'scatter',
  'history',
  'code',
  'form',
  'accordion',
  'network',
  'model3d',
  'scene3d',
] as const;

/** Whether a view targets a concept's list (many rows) or the detail of a single item. */
export const viewScopeSchema = z.enum(['list', 'detail']);
export type ViewScope = z.infer<typeof viewScopeSchema>;

export const viewSpecSchema = z.object({
  version: z.literal(VIEW_SPEC_VERSION).default(VIEW_SPEC_VERSION),
  /** Stable identifier of the view. */
  id: z.string().min(1),
  /** Concept (GraphQL object type) this view is bound to. */
  concept: z.string().min(1),
  /**
   * The concrete target this view is associated with: the concept's list (many
   * rows) or the detail of a single item. Distinguishes, e.g., "Account list"
   * from "Account detail" so a view created in one context never leaks into the
   * other. Optional for backward compatibility with pre-scope saved views.
   */
  scope: viewScopeSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  /** Named GraphQL queries widgets pull their data from. */
  queries: z.record(z.string(), querySpecSchema),
  /** Named GraphQL mutations widgets can trigger (see docs/architecture/MUTATIONS.md). */
  actions: z.record(z.string(), actionSpecSchema).optional(),
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

// -----------------------------------------------------------------------------
// Draft spec — the LLM generation target
// -----------------------------------------------------------------------------
// When an assistant generates a view it only produces the *authored* part:
// the title/description, the named queries and the widgets. The server-managed
// fields (version, stable id, bound concept) are filled in afterwards by
// `finalizeViewSpec`, so the model never has to invent them.

export const viewSpecDraftSchema = viewSpecSchema.omit({
  version: true,
  id: true,
  concept: true,
});
export type ViewSpecDraft = z.infer<typeof viewSpecDraftSchema>;

/** Parse an unknown value as a draft view spec (returns a SafeParseReturnType). */
export function safeParseViewSpecDraft(input: unknown) {
  return viewSpecDraftSchema.safeParse(input);
}

/** Turn a validated draft into a full, renderable/persistable ViewSpec. */
export function finalizeViewSpec(
  draft: ViewSpecDraft,
  meta: { concept: string; id: string },
): ViewSpec {
  return {
    version: VIEW_SPEC_VERSION,
    id: meta.id,
    concept: meta.concept,
    ...draft,
  };
}

// -----------------------------------------------------------------------------
// Widget generation (single widget modification)
// -----------------------------------------------------------------------------
// A "widget draft" is the LLM-generated widget without a stable id.
// The frontend or server assigns the id based on context (new or replacing existing).

// Widget-specific schemas without id field
const tableWidgetDraftSchema = tableWidgetSchema.omit({ id: true });
const statisticWidgetDraftSchema = statisticWidgetSchema.omit({ id: true });
const descriptionsWidgetDraftSchema = descriptionsWidgetSchema.omit({ id: true });
const lineWidgetDraftSchema = lineWidgetSchema.omit({ id: true });
const barWidgetDraftSchema = barWidgetSchema.omit({ id: true });
const areaWidgetDraftSchema = areaWidgetSchema.omit({ id: true });
const pieWidgetDraftSchema = pieWidgetSchema.omit({ id: true });
const treeWidgetDraftSchema = treeWidgetSchema.omit({ id: true });
const richTextWidgetDraftSchema = richTextWidgetSchema.omit({ id: true });
const scatterWidgetDraftSchema = scatterWidgetSchema.omit({ id: true });
const codeWidgetDraftSchema = codeWidgetSchema.omit({ id: true });
const formWidgetDraftSchema = formWidgetSchema.omit({ id: true });
const accordionWidgetDraftSchema = accordionWidgetSchema.omit({ id: true });
const model3dWidgetDraftSchema = model3dWidgetSchema.omit({ id: true });
const scene3dWidgetDraftSchema = scene3dWidgetSchema.omit({ id: true });

const coreWidgetDraftSchema = z.discriminatedUnion('type', [
  tableWidgetDraftSchema,
  statisticWidgetDraftSchema,
  descriptionsWidgetDraftSchema,
  lineWidgetDraftSchema,
  barWidgetDraftSchema,
  areaWidgetDraftSchema,
  pieWidgetDraftSchema,
  treeWidgetDraftSchema,
  richTextWidgetDraftSchema,
  scatterWidgetDraftSchema,
  historyWidgetDraftSchema,
  codeWidgetDraftSchema,
  formWidgetDraftSchema,
  accordionWidgetDraftSchema,
  networkWidgetDraftSchema,
  model3dWidgetDraftSchema,
  scene3dWidgetDraftSchema,
]);
export const widgetDraftSchema = z.union([coreWidgetDraftSchema, pluginWidgetDraftSchema]);
export type WidgetDraft = z.infer<typeof widgetDraftSchema>;

/** Parse an unknown value as a draft widget (returns a SafeParseReturnType). */
export function safeParseWidgetDraft(input: unknown) {
  return widgetDraftSchema.safeParse(input);
}

/** Turn a validated widget draft into a full widget. */
export function finalizeWidget(draft: WidgetDraft, id: string): Widget {
  return {
    ...draft,
    id,
  };
}
