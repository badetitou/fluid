import { z } from 'zod';

// Small HTTP client of a running fluid. Every answer is validated; nothing here opens the data dir.

export type FluidErrorKind = 'unreachable' | 'timeout' | 'auth-required' | 'not-found' | 'invalid' | 'too-large' | 'http';

export class FluidApiError extends Error {
  constructor(
    readonly kind: FluidErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const sourceSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  authKind: z.string(),
  oauth: z.looseObject({ signedIn: z.boolean() }).nullish(),
});
export type SourceInfo = z.infer<typeof sourceSchema>;

const viewRowSchema = z.looseObject({ id: z.string(), title: z.string(), concept: z.string() });
export type ViewRow = z.infer<typeof viewRowSchema>;

/** Only what summaries need is checked; the full spec travels to the viewer unchanged. */
const specSchema = z.looseObject({
  title: z.string(),
  widgets: z.array(z.looseObject({ type: z.string().optional() })).default([]),
  queries: z.record(z.string(), z.unknown()).default({}),
});
export type SpecInfo = z.infer<typeof specSchema>;

const storedViewSchema = viewRowSchema.extend({ spec: z.unknown() });

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

export interface RunParams {
  sourceId: string;
  variables?: Record<string, unknown>;
  take?: number;
}

export interface FluidApi {
  listSources(): Promise<SourceInfo[]>;
  listViews(concept?: string): Promise<ViewRow[]>;
  getView(id: string): Promise<{ row: ViewRow; spec: SpecInfo; rawSpec: unknown }>;
  runView(id: string, params: RunParams): Promise<RunOutput>;
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
      const spec = specSchema.safeParse(stored.spec);
      if (!spec.success) throw new FluidApiError('invalid', `view ${viewId} has an invalid spec`);
      return { row: stored, spec: spec.data, rawSpec: stored.spec };
    },
    runView: (viewId, params) =>
      call(`/api/views/${enc(viewId)}/run`, runSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      }),
  };
}
