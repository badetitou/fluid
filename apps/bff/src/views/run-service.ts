import { viewSpecSchema, type QuerySpec, type ViewSpec } from '@fluid/shared';
import type { UpstreamEnvelope } from '../sources/model';
import { AUTH_REQUIRED_CODE } from '../sources/oauth/model';
import type { SourceService } from '../sources/service';
import { buildVariables, declaredVariables, NotARead, type RunViewBody } from './model';
import type { ViewReader } from './repository';

export interface QueryResult {
  data?: unknown;
  errors?: unknown[];
}

export type RunViewOutcome =
  | { kind: 'view-not-found' }
  | { kind: 'source-not-found' }
  | { kind: 'invalid-spec'; issues: string[] }
  /** More runnable queries than `maxQueries`: nothing runs (422). */
  | { kind: 'too-many-queries'; max: number }
  /** Every query needed a sign-in: same status and body as the GraphQL proxy. */
  | { kind: 'auth-required'; status: number; body: UpstreamEnvelope }
  | { kind: 'ok'; results: Record<string, QueryResult>; skipped?: string[] };

/** What running a spec that is not stored can answer. */
export type RunSpecOutcome = Exclude<
  RunViewOutcome,
  { kind: 'view-not-found' } | { kind: 'invalid-spec' }
>;

export interface ViewRunService {
  run(viewId: string, body: RunViewBody): Promise<RunViewOutcome>;
  /** Runs the queries of a spec that is not stored (a draft), with the same rules as a saved view. */
  runSpec(spec: ViewSpec, body: RunViewBody): Promise<RunSpecOutcome>;
}

export interface ViewRunLimits {
  /** Queries (without plugin source) per call; more is refused. */
  maxQueries: number;
  /** Queries in flight at once. */
  concurrency: number;
  /** No new query starts after this; bounds the call to about this + one source timeout. */
  deadlineMs: number;
}
export const DEFAULT_LIMITS: ViewRunLimits = { maxQueries: 20, concurrency: 4, deadlineMs: 60_000 };

const isAuthRequired = (body: { errors?: unknown[] }) =>
  body.errors?.some(
    (e) => (e as { extensions?: { code?: unknown } }).extensions?.code === AUTH_REQUIRED_CODE,
  ) ?? false;
const errorResult = (message: string): QueryResult => ({ errors: [{ message }] });

/** Runs the stored queries of a view through the sources service (same code path as the proxy). */
export function createViewRunService(
  views: ViewReader,
  sources: Pick<SourceService, 'get' | 'runGraphql'>,
  limits: Partial<ViewRunLimits> = {},
  now: () => number = Date.now,
): ViewRunService {
  const { maxQueries, concurrency, deadlineMs } = { ...DEFAULT_LIMITS, ...limits };

  async function runSpec(spec: ViewSpec, body: RunViewBody): Promise<RunSpecOutcome> {
    const entries = Object.entries(spec.queries);
    const runnable = entries.filter(([, q]) => !q.source);
    // A plugin data source runs in the browser.
    const skipped = entries.filter(([, q]) => q.source).map(([name]) => name);
    if (runnable.length > maxQueries) return { kind: 'too-many-queries', max: maxQueries };
    // Without a query to run, the source is not otherwise looked up (and only then, so a run loads the credential once).
    if (runnable.length === 0 && !(await sources.get(body.sourceId)))
      return { kind: 'source-not-found' };

    const started = now();
    const outcomes: QueryResult[] = new Array(runnable.length);
    const seen: { auth?: { status: number; body: UpstreamEnvelope } } = {};
    let missingSource = false;
    let next = 0;

    async function runOne(q: QuerySpec): Promise<QueryResult> {
      let variables: Record<string, unknown>;
      try {
        variables = buildVariables(q, declaredVariables(q.query), body);
      } catch (err) {
        if (err instanceof NotARead) return errorResult(err.message);
        return errorResult(`Invalid query: ${err instanceof Error ? err.message : 'parse error'}`);
      }
      const res = await sources.runGraphql(body.sourceId, { query: q.query, variables });
      if (!res) {
        missingSource = true;
        return errorResult('Source not found');
      }
      if (isAuthRequired(res.body)) seen.auth = { status: res.status, body: res.body };
      return {
        ...(res.body.data !== undefined ? { data: res.body.data } : {}),
        ...(res.body.errors ? { errors: res.body.errors } : {}),
      };
    }

    async function worker() {
      while (next < runnable.length && !missingSource) {
        const i = next++;
        if (seen.auth)
          outcomes[i] = { errors: seen.auth.body.errors }; // the sign-in is missing for the others too
        else if (now() - started > deadlineMs) outcomes[i] = errorResult('Run time limit reached');
        else outcomes[i] = await runOne(runnable[i][1]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, runnable.length) }, worker));
    if (missingSource) return { kind: 'source-not-found' };

    // No prototype: a query may be named `__proto__`.
    const results = Object.create(null) as Record<string, QueryResult>;
    runnable.forEach(([name], i) => (results[name] = outcomes[i]));
    if (seen.auth && outcomes.every(isAuthRequired)) return { kind: 'auth-required', ...seen.auth };
    return { kind: 'ok', results, ...(skipped.length ? { skipped } : {}) };
  }

  return {
    async run(viewId, body) {
      const raw = await views.getSpec(viewId);
      if (raw === null) return { kind: 'view-not-found' };
      const spec = viewSpecSchema.safeParse(raw);
      if (!spec.success) {
        return {
          kind: 'invalid-spec',
          issues: spec.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        };
      }
      return runSpec(spec.data, body);
    },
    runSpec,
  };
}
