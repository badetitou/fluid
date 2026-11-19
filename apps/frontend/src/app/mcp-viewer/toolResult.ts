import { z } from 'zod';
import { viewSpecSchema, type ViewSpec } from '@fluid/shared';
import { injectItemId } from '../../entities/view/model';

/** What one query of the BFF run answered (the `results` map of `show_view` / `run_queries`). */
export const queryResultSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.unknown()).optional(),
});
export type QueryResult = z.infer<typeof queryResultSchema>;

export const runOutputSchema = z.object({ results: z.record(z.string(), queryResultSchema) });

const showViewSchema = z.object({
  viewId: z.string().min(1),
  sourceId: z.string().min(1),
  take: z.number().int().positive().optional(),
  spec: z.unknown(),
  data: z.record(z.string(), queryResultSchema),
  /** The variables the view ran with (the item id of a detail view). */
  variables: z.record(z.string(), z.unknown()).optional(),
  /** Where fluid runs, to open an item there. */
  fluidUrl: z.string().url().optional().catch(undefined),
});

/** `draft_view`: a view the assistant wrote, not saved yet. */
const draftViewSchema = showViewSchema.omit({ viewId: true }).extend({
  draft: z.literal(true),
  concept: z.string().min(1),
  request: z.string().min(1),
  issues: z.array(z.string()).default([]),
});

const toolResultSchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  structuredContent: z.unknown().optional(),
});

/** What the viewer needs to save a drafted view (`save_view`). */
export interface DraftInfo {
  concept: string;
  request: string;
  issues: string[];
}

/** The view to show, with the data `show_view` (or `draft_view`) already ran. */
export interface ViewPayload {
  /** Unset for a draft until it is saved. */
  viewId?: string;
  draft?: DraftInfo;
  sourceId: string;
  /** Rows the first run asked for, when the server said. */
  take?: number;
  spec: ViewSpec;
  data: Record<string, QueryResult>;
  variables?: Record<string, unknown>;
  fluidUrl?: string;
}

export type ParsedToolResult = { kind: 'view'; payload: ViewPayload } | { kind: 'error'; message: string };

const textOf = (content: z.infer<typeof toolResultSchema>['content']): string =>
  (content ?? []).map((c) => c.text).filter(Boolean).join('\n');

/** Validates a `ui/notifications/tool-result` (host data is untrusted) into a view or an error to show. */
export function parseToolResult(params: unknown): ParsedToolResult {
  const result = toolResultSchema.safeParse(params);
  if (!result.success) return { kind: 'error', message: 'The host sent an unreadable tool result.' };
  const { isError, content, structuredContent } = result.data;
  if (isError) return { kind: 'error', message: textOf(content) || 'The tool failed.' };
  const drafted = draftViewSchema.safeParse(structuredContent);
  const shown = drafted.success ? drafted : showViewSchema.safeParse(structuredContent);
  if (!shown.success) return { kind: 'error', message: 'This result is not a fluid view.' };
  const spec = viewSpecSchema.safeParse(shown.data.spec);
  if (!spec.success) return { kind: 'error', message: 'The view spec is not valid.' };
  const { sourceId, take, data, variables, fluidUrl } = shown.data;
  const common = { sourceId, take, data, ...(variables ? { variables } : {}), ...(fluidUrl ? { fluidUrl } : {}) };
  // The item id of a detail view goes into the queries that read it, as in the app's columns.
  const itemId = typeof variables?.id === 'string' || typeof variables?.id === 'number' ? String(variables.id) : undefined;
  const shownSpec = injectItemId(spec.data, undefined, itemId);
  if (drafted.success) {
    const { concept, request, issues } = drafted.data;
    return { kind: 'view', payload: { ...common, spec: shownSpec, draft: { concept, request, issues } } };
  }
  return { kind: 'view', payload: { ...common, viewId: (shown.data as { viewId: string }).viewId, spec: shownSpec } };
}

/** The results of a `run_queries` call; throws with the error text it carried. */
export function parseRunResult(params: unknown): Record<string, QueryResult> {
  const result = toolResultSchema.safeParse(params);
  if (!result.success) throw new Error('The host sent an unreadable answer.');
  if (result.data.isError) throw new Error(textOf(result.data.content) || 'run_queries failed.');
  const run = runOutputSchema.safeParse(result.data.structuredContent);
  if (!run.success) throw new Error('run_queries answered something unexpected.');
  return run.data.results;
}

/** The answer of `save_view`; throws with the error text it carried. */
export function parseSaveResult(params: unknown): { viewId: string; title: string } {
  const result = toolResultSchema.safeParse(params);
  if (!result.success) throw new Error('The host sent an unreadable answer.');
  if (result.data.isError) throw new Error(textOf(result.data.content) || 'save_view failed.');
  const saved = z.object({ viewId: z.string().min(1), title: z.string() }).safeParse(result.data.structuredContent);
  if (!saved.success) throw new Error('save_view answered something unexpected.');
  return saved.data;
}

const viewRowsSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string(), concept: z.string(), scope: z.string().optional() })),
});

/** The rows of a `list_views` call; throws with the error text it carried. */
export function parseViewRows(params: unknown): z.infer<typeof viewRowsSchema>['items'] {
  const result = toolResultSchema.safeParse(params);
  if (!result.success) throw new Error('The host sent an unreadable answer.');
  if (result.data.isError) throw new Error(textOf(result.data.content) || 'list_views failed.');
  const rows = viewRowsSchema.safeParse(result.data.structuredContent);
  if (!rows.success) throw new Error('list_views answered something unexpected.');
  return rows.data.items;
}
