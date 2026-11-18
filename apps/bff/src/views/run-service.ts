import { viewSpecSchema } from '@fluid/shared';
import type { UpstreamEnvelope } from '../sources/model';
import type { SourceService } from '../sources/service';
import { buildVariables, declaredVariables, type RunViewBody } from './run-model';
import type { ViewReader } from './repository';

export interface QueryResult {
  data?: unknown;
  errors?: unknown[];
}

export type RunViewOutcome =
  | { kind: 'view-not-found' }
  | { kind: 'source-not-found' }
  | { kind: 'invalid-spec'; issues: string[] }
  /** Every query needed a sign-in: same status and body as the GraphQL proxy. */
  | { kind: 'auth-required'; status: number; body: UpstreamEnvelope }
  | { kind: 'ok'; results: Record<string, QueryResult>; skipped?: string[] };

export interface ViewRunService {
  run(viewId: string, body: RunViewBody): Promise<RunViewOutcome>;
}

const isAuthRequired = (body: UpstreamEnvelope) =>
  body.errors?.some((e) => (e.extensions as { code?: unknown } | undefined)?.code === 'FLUID_AUTH_REQUIRED') ?? false;

/** Runs the stored queries of a view through the sources service (same code path as the proxy). */
export function createViewRunService(views: ViewReader, sources: Pick<SourceService, 'get' | 'runGraphql'>): ViewRunService {
  return {
    async run(viewId, body) {
      const raw = await views.getSpec(viewId);
      if (raw === null) return { kind: 'view-not-found' };
      if (!(await sources.get(body.sourceId))) return { kind: 'source-not-found' };
      const spec = viewSpecSchema.safeParse(raw);
      if (!spec.success) {
        return { kind: 'invalid-spec', issues: spec.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
      }

      const results: Record<string, QueryResult> = {};
      const skipped: string[] = [];
      let auth: { status: number; body: UpstreamEnvelope } | undefined;
      let authFailures = 0;
      for (const [name, q] of Object.entries(spec.data.queries)) {
        if (q.source) {
          skipped.push(name); // a plugin data source runs in the browser
          continue;
        }
        let variables: Record<string, unknown>;
        try {
          variables = buildVariables(q, declaredVariables(q.query), body);
        } catch (err) {
          results[name] = { errors: [{ message: `Invalid query: ${err instanceof Error ? err.message : 'parse error'}` }] };
          continue;
        }
        const res = await sources.runGraphql(body.sourceId, { query: q.query, variables });
        if (!res) return { kind: 'source-not-found' };
        if (isAuthRequired(res.body)) {
          auth = { status: res.status, body: res.body };
          authFailures++;
        }
        results[name] = {
          ...(res.body.data !== undefined ? { data: res.body.data } : {}),
          ...(res.body.errors ? { errors: res.body.errors } : {}),
        };
      }
      const ran = Object.keys(results).length;
      if (auth && authFailures === ran) return { kind: 'auth-required', ...auth };
      return { kind: 'ok', results, ...(skipped.length ? { skipped } : {}) };
    },
  };
}
