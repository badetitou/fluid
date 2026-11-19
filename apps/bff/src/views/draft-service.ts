import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { finalizeViewSpec, mcpWidgetCatalog, viewScopeSchema, type ViewSpec } from '@fluid/shared';
import { validateDraftValue } from '../llm/validateDraft';
import type { SourceService } from '../sources/service';
import { MAX_TAKE } from './model';
import type { SavedViewRow, ViewWriter } from './repository';
import type { RunSpecOutcome, ViewRunService } from './run-service';
import { checkQueries, schemaSdl, type SchemaLookup } from './schema-check';

// Views written by an assistant through MCP: checked like the in-app assistant's drafts (same
// validation, MCP widget catalog), then their queries are checked against the source schema and run.

const draftFields = {
  sourceId: z.string().min(1),
  /** GraphQL type the view is about. */
  concept: z.string().min(1).max(200),
  scope: viewScopeSchema.optional(),
  /** The user's request, kept as the view's intent. */
  request: z.string().min(1).max(2000),
  /** The draft itself, validated by `validateDraftValue`. */
  view: z.unknown(),
};
export const draftViewBody = z.strictObject({ ...draftFields, take: z.number().int().min(1).max(MAX_TAKE).optional() });
export type DraftViewBody = z.infer<typeof draftViewBody>;
export const saveDraftBody = z.strictObject(draftFields);
export type SaveDraftBody = z.infer<typeof saveDraftBody>;

export type DraftOutcome =
  | { kind: 'source-not-found' }
  | { kind: 'invalid'; issues: string[] }
  | Exclude<RunSpecOutcome, { kind: 'ok' }>
  /** `issues` lists what is wrong but did not stop the run (queries the schema rejects, a schema that could not be read). */
  | { kind: 'ok'; spec: ViewSpec; data: Extract<RunSpecOutcome, { kind: 'ok' }>['results']; issues: string[]; skipped?: string[] };

export type SaveOutcome = { kind: 'source-not-found' } | { kind: 'invalid'; issues: string[] } | { kind: 'ok'; view: SavedViewRow };

export type SchemaOutcome = { kind: 'source-not-found' } | { kind: 'unavailable'; error: string } | { kind: 'ok'; sdl: string; truncated: boolean };

export interface ViewDraftService {
  /** The source schema as SDL, for the assistant to write queries. */
  schema(sourceId: string): Promise<SchemaOutcome>;
  draft(body: DraftViewBody): Promise<DraftOutcome>;
  save(body: SaveDraftBody): Promise<SaveOutcome>;
}

const splitIssues = (text: string) => text.split('\n').filter(Boolean);

export function createViewDraftService(deps: {
  sources: Pick<SourceService, 'get'>;
  schemas: SchemaLookup;
  runs: Pick<ViewRunService, 'runSpec'>;
  writer: ViewWriter;
}): ViewDraftService {
  /** The finalized spec and the schema issues, or why the draft is refused. */
  async function check(body: SaveDraftBody, idPrefix: string) {
    if (!(await deps.sources.get(body.sourceId))) return { kind: 'source-not-found' as const };
    const schema = await deps.schemas(body.sourceId);
    const known = 'schema' in schema ? schema.mutationFields : undefined;
    const valid = validateDraftValue(body.view, mcpWidgetCatalog(), known);
    if (!valid.ok) return { kind: 'invalid' as const, issues: splitIssues(valid.errorText) };
    const spec: ViewSpec = {
      ...finalizeViewSpec(valid.draft, { concept: body.concept, id: `${idPrefix}-${randomUUID().slice(0, 8)}`, intent: body.request }),
      ...(body.scope ? { scope: body.scope } : {}),
    };
    // Queries the schema rejects break the view; an unreadable schema is only reported.
    const queryIssues = 'schema' in schema ? checkQueries(schema.schema, spec.queries) : [];
    const notes = 'schema' in schema ? [] : [`The source schema could not be read (${schema.error}): queries were not checked against it.`];
    return { kind: 'checked' as const, spec, queryIssues, notes };
  }

  return {
    async schema(sourceId) {
      if (!(await deps.sources.get(sourceId))) return { kind: 'source-not-found' };
      const found = await deps.schemas(sourceId);
      return 'schema' in found ? { kind: 'ok', ...schemaSdl(found.schema) } : { kind: 'unavailable', error: found.error };
    },
    async draft(body) {
      const checked = await check(body, 'draft');
      if (checked.kind !== 'checked') return checked;
      const run = await deps.runs.runSpec(checked.spec, { sourceId: body.sourceId, ...(body.take ? { take: body.take } : {}) });
      if (run.kind !== 'ok') return run;
      const issues = [...checked.queryIssues, ...checked.notes];
      return { kind: 'ok', spec: checked.spec, data: run.results, issues, ...(run.skipped ? { skipped: run.skipped } : {}) };
    },
    async save(body) {
      const checked = await check(body, 'mcp');
      if (checked.kind !== 'checked') return checked;
      if (checked.queryIssues.length) return { kind: 'invalid', issues: checked.queryIssues };
      return { kind: 'ok', view: await deps.writer.create(checked.spec) };
    },
  };
}
