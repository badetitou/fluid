import { z } from 'zod';

// Small HTTP client of a running fluid. Every answer is validated; nothing here opens the data dir.

export type FluidErrorKind = 'unreachable' | 'timeout' | 'auth-required' | 'not-found' | 'forbidden' | 'invalid' | 'too-large' | 'rejected' | 'http';

export class FluidApiError extends Error {
  constructor(
    readonly kind: FluidErrorKind,
    message: string,
    /** For `rejected`: what fluid found wrong in what was sent (a view draft). */
    readonly issues: string[] = [],
  ) {
    super(message);
  }
}

const sourceSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  authKind: z.string(),
  allowWrites: z.boolean().optional(),
  oauth: z.looseObject({ signedIn: z.boolean() }).nullish(),
});
export type SourceInfo = z.infer<typeof sourceSchema>;

const viewRowSchema = z.looseObject({
  id: z.string(),
  title: z.string(),
  concept: z.string(),
  spec: z.looseObject({ scope: z.string().optional().catch(undefined) }).optional().catch(undefined),
});
export type ViewRow = z.infer<typeof viewRowSchema>;

/** Only what summaries need is checked; the full spec travels to the viewer unchanged. */
const specSchema = z.looseObject({
  title: z.string(),
  widgets: z.array(z.looseObject({ type: z.string().optional() })).default([]),
  queries: z.record(z.string(), z.unknown()).default({}),
});
export type SpecInfo = z.infer<typeof specSchema>;

const storedViewSchema = viewRowSchema.omit({ spec: true }).extend({ spec: z.unknown() });

/** The summary fields of a spec, or null when it does not have them. */
export function parseSpecInfo(raw: unknown): SpecInfo | null {
  const spec = specSchema.safeParse(raw);
  return spec.success ? spec.data : null;
}

const queryResultSchema = z.looseObject({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() });
export type QueryResult = z.infer<typeof queryResultSchema>;
const runSchema = z.looseObject({
  results: z.record(z.string(), queryResultSchema),
  skipped: z.array(z.string()).optional(),
});
export type RunOutput = z.infer<typeof runSchema>;

const AUTH_CODE = 'FLUID_AUTH_REQUIRED';
/** Whether a GraphQL-style body (or query result) carries a FLUID_AUTH_REQUIRED error. */
export const hasAuthRequired = (body: unknown): boolean => {
  const errors = (body as { errors?: unknown } | null)?.errors;
  return (
    Array.isArray(errors) &&
    errors.some((e) => (e as { extensions?: { code?: unknown } } | null)?.extensions?.code === AUTH_CODE)
  );
};
/** The BFF's `error` text, on one line and at most 200 characters (it is shown to the model). */
const errorField = (body: unknown): string | undefined => {
  const message = (body as { error?: unknown } | null | undefined)?.error;
  if (typeof message !== 'string') return undefined;
  const line = message.replace(/\s+/g, ' ').trim();
  return line.length > 200 ? `${line.slice(0, 200)}...` : line;
};

const issuesSchema = z.object({ issues: z.array(z.string()).max(50) });

const draftOutSchema = runSchema.extend({ spec: z.unknown(), issues: z.array(z.string()).default([]) });
export type DraftOutput = z.infer<typeof draftOutSchema>;
const savedSchema = viewRowSchema;
const sdlSchema = z.object({ sdl: z.string(), truncated: z.boolean() });
const actionOutSchema = z.looseObject({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() });
export type ActionOutput = z.infer<typeof actionOutSchema>;

/** A view written by the assistant: the draft and what it is for. */
export interface DraftParams {
  sourceId: string;
  concept: string;
  scope?: 'list' | 'detail';
  /** The user's request, kept as the saved view's intent. */
  request: string;
  view: Record<string, unknown>;
}

export interface RunParams {
  sourceId: string;
  variables?: Record<string, unknown>;
  take?: number;
}

export interface FluidApi {
  listSources(): Promise<SourceInfo[]>;
  listViews(concept?: string): Promise<ViewRow[]>;
  getView(id: string): Promise<{ row: Omit<ViewRow, 'spec'>; spec: SpecInfo; rawSpec: unknown }>;
  runView(id: string, params: RunParams): Promise<RunOutput>;
  sourceSchema(sourceId: string): Promise<{ sdl: string; truncated: boolean }>;
  draftView(params: DraftParams & { take?: number }): Promise<DraftOutput>;
  saveDraft(params: DraftParams): Promise<ViewRow>;
  invokeAction(viewId: string, action: string, params: { sourceId: string; variables?: Record<string, unknown> }): Promise<ActionOutput>;
}

export function createFluidApi(baseUrl: string, fetchImpl: typeof fetch = fetch, timeoutMs = 90_000): FluidApi {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if ((err as { name?: unknown } | null)?.name === 'TimeoutError') {
        throw new FluidApiError('timeout', `fluid at ${base} did not answer in time`);
      }
      throw new FluidApiError('unreachable', `fluid is not reachable at ${base}`);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if ((res.status === 401 || res.status === 403) && hasAuthRequired(body)) {
      throw new FluidApiError('auth-required', 'sign-in required');
    }
    if (res.status === 404) throw new FluidApiError('not-found', errorField(body) ?? 'not found');
    if (res.status === 403) throw new FluidApiError('forbidden', errorField(body) ?? 'not allowed');
    const rejected = res.status === 422 ? issuesSchema.safeParse(body) : undefined;
    if (rejected?.success) throw new FluidApiError('rejected', errorField(body) ?? 'rejected', rejected.data.issues);
    if (!res.ok) {
      const detail = errorField(body);
      throw new FluidApiError('http', `fluid answered ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new FluidApiError('invalid', `unexpected answer from fluid for ${path} (is ${base} a fluid server?)`);
    }
    return parsed.data;
  }

  const enc = encodeURIComponent;
  return {
    listSources: () => call('/api/sources', z.array(sourceSchema)),
    listViews: (concept) => call(`/api/views${concept ? `?concept=${enc(concept)}` : ''}`, z.array(viewRowSchema)),
    async getView(viewId) {
      const stored = await call(`/api/views/${enc(viewId)}`, storedViewSchema);
      const spec = parseSpecInfo(stored.spec);
      if (!spec) throw new FluidApiError('invalid', `view ${viewId} has an invalid spec`);
      return { row: stored, spec, rawSpec: stored.spec };
    },
    runView: (viewId, params) =>
      call(`/api/views/${enc(viewId)}/run`, runSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      }),
    sourceSchema: (sourceId) => call(`/api/views/draft/schema?sourceId=${enc(sourceId)}`, sdlSchema),
    draftView: (params) => call('/api/views/draft', draftOutSchema, post(params)),
    saveDraft: (params) => call('/api/views/from-draft', savedSchema, post(params)),
    invokeAction: (viewId, action, params) => call(`/api/views/${enc(viewId)}/actions/${enc(action)}`, actionOutSchema, post(params)),
  };
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
