import { z } from 'zod';
import { viewSpecSchema, type ViewSpec } from '@fluid/shared';

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
});

const toolResultSchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  structuredContent: z.unknown().optional(),
});

/** The view to show, with the data `show_view` already ran. */
export interface ViewPayload {
  viewId: string;
  sourceId: string;
  /** Rows the first run asked for, when the server said. */
  take?: number;
  spec: ViewSpec;
  data: Record<string, QueryResult>;
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
  const shown = showViewSchema.safeParse(structuredContent);
  if (!shown.success) return { kind: 'error', message: 'This result is not a fluid view.' };
  const spec = viewSpecSchema.safeParse(shown.data.spec);
  if (!spec.success) return { kind: 'error', message: 'The view spec is not valid.' };
  const { viewId, sourceId, take, data } = shown.data;
  return { kind: 'view', payload: { viewId, sourceId, take, spec: spec.data, data } };
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
