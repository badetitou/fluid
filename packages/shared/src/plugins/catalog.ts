import { z } from 'zod';
import {
  BUILTIN_WIDGET_CONTRACTS,
  externalWidgetContractSchema,
  type WidgetContract,
} from './contracts';
import { flattenIssues } from './issues';
import { outputQuery, outputSource } from './ports';
import { isPluginWidgetType } from './widgetType';

// -----------------------------------------------------------------------------
// The active widget catalog
// -----------------------------------------------------------------------------
// Which widgets the user enabled, as the frontend sends it with every LLM
// request: the built-in types of the enabled collections, and the contracts of
// the installed plugins. The BFF prompts with these widgets only and checks the
// answer against them.

export const widgetCatalogRequestSchema = z.object({
  /** Enabled built-in widget types; every built-in type when omitted. */
  types: z.array(z.string()).optional(),
  /** Contracts of the widgets of enabled plugins. */
  external: z.array(externalWidgetContractSchema).optional(),
});
export type WidgetCatalogRequest = z.infer<typeof widgetCatalogRequestSchema>;

/** A widget of the view a widget is generated in: the agent may wire to its outputs. */
export const viewWidgetInfoSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().optional(),
  outputs: z.array(z.string()).optional(),
});
export type ViewWidgetInfo = z.infer<typeof viewWidgetInfoSchema>;

/** The contracts of the widgets a request may use. */
export function resolveWidgetCatalog(request?: WidgetCatalogRequest): WidgetContract[] {
  const enabled = request?.types ? new Set(request.types) : null;
  const core = Object.values(BUILTIN_WIDGET_CONTRACTS).filter(
    (c) => !enabled || enabled.has(c.type),
  );
  return [...core, ...(request?.external ?? [])];
}

/** The widget shapes of the prompt. Widget drafts have no `id` (the system assigns it). */
export function renderWidgetDocs(contracts: WidgetContract[], { withId = true } = {}): string {
  return contracts
    .map((c) => (withId ? c.llmDoc : c.llmDoc.replace('"id": string, ', '')))
    .join('\n');
}

/** How widgets pass values to each other, for the widgets that have outputs. */
export function renderPortDocs(contracts: WidgetContract[]): string {
  const emitting = contracts.filter((c) => c.outputs.length > 0);
  if (emitting.length === 0) return '';
  const lines = emitting.map(
    (c) =>
      `  - "${c.type}": ${c.outputs.map((o) => `"${o.name}" (${o.shape}) — ${o.description}`).join('; ')}`,
  );
  return [
    'Widget outputs (WIRING): some widgets emit a value when the user interacts with them:',
    ...lines,
    `Another widget of the same view reads it with the reserved query "${outputQuery('<widgetId>')}" and the output name as path,`,
    `e.g. "data": { "query": "${outputQuery('people')}", "path": "selected" } shows the row last clicked in the "people" table.`,
    'Until the user interacts, that data is empty. Use it for master/detail layouts; do not declare it in "queries".',
  ].join('\n');
}

const pluginSchemas = new WeakMap<object, z.ZodType>();

function pluginSchema(contract: WidgetContract): z.ZodType | null {
  if (!contract.jsonSchema) return null;
  let schema = pluginSchemas.get(contract.jsonSchema);
  if (!schema) {
    schema = z.fromJSONSchema(contract.jsonSchema as Parameters<typeof z.fromJSONSchema>[0]);
    pluginSchemas.set(contract.jsonSchema, schema);
  }
  return schema;
}

type WidgetLike = { type?: unknown; id?: unknown; data?: unknown; widgets?: unknown };

const asWidgets = (value: unknown): WidgetLike[] =>
  Array.isArray(value)
    ? value.filter((w): w is WidgetLike => typeof w === 'object' && w !== null)
    : [];

function collectIds(widgets: WidgetLike[], ids: Set<string>): Set<string> {
  for (const w of widgets) {
    if (typeof w.id === 'string') ids.add(w.id);
    collectIds(asWidgets(w.widgets), ids);
  }
  return ids;
}

/**
 * Problems of already schema-valid widgets against the active catalog: a type
 * that is not enabled, a plugin widget that does not match its plugin's schema,
 * an output binding (`@<id>`) to a widget the view does not have. Nested
 * widgets (accordions) are checked too. Returns readable lines; empty when fine.
 */
export function checkWidgetsAgainstCatalog(
  widgets: unknown,
  contracts: WidgetContract[],
  path = 'widgets',
  knownIds?: Set<string>,
): string[] {
  const byType = new Map(contracts.map((c) => [c.type, c]));
  const list = asWidgets(widgets);
  const ids = knownIds ?? collectIds(list, new Set());
  return list.flatMap((widget, index) => {
    const at = `${path}.${index}`;
    const type = String(widget.type);
    const contract = byType.get(type);
    if (!contract) {
      return [
        `${at}.type: "${type}" is not an available widget type (available: ${[...byType.keys()].join(', ')})`,
      ];
    }
    const problems: string[] = [];
    const schema = isPluginWidgetType(type) ? pluginSchema(contract) : null;
    const parsed = schema?.safeParse(widget);
    if (parsed && !parsed.success) problems.push(...flattenIssues(parsed.error.issues, [at]));
    const query = (widget.data as { query?: unknown } | undefined)?.query;
    const source = typeof query === 'string' ? outputSource(query) : null;
    if (source !== null && !ids.has(source)) {
      problems.push(
        `${at}.data.query: "${query}" reads the outputs of "${source}", which is not a widget of this view`,
      );
    }
    return [
      ...problems,
      ...checkWidgetsAgainstCatalog(widget.widgets, contracts, `${at}.widgets`, ids),
    ];
  });
}
