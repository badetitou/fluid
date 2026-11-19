import { Kind, OperationTypeNode, parse } from 'graphql';
import { z } from 'zod';
import { viewSpecSchema } from '@fluid/shared';
import type { UpstreamEnvelope } from '../sources/model';
import { AUTH_REQUIRED_CODE } from '../sources/oauth/model';
import type { SourceService } from '../sources/service';
import { MAX_VARIABLES_BYTES } from './model';
import type { ActionLog, ViewReader } from './repository';

// Runs a saved view's action (its stored mutation) on a source that allows writes, and logs each run.
// Only the action's own document runs: the caller gives the action key and the variables.

export const invokeActionBody = z.strictObject({
  sourceId: z.string().min(1),
  /** The resolved variables ($target / $form already replaced by the viewer). */
  variables: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= MAX_VARIABLES_BYTES, 'variables are too large')
    .optional(),
});
export type InvokeActionBody = z.infer<typeof invokeActionBody>;

export type ActionOutcome =
  | { kind: 'view-not-found' }
  | { kind: 'action-not-found' }
  | { kind: 'source-not-found' }
  | { kind: 'writes-disabled' }
  | { kind: 'invalid'; error: string }
  | { kind: 'auth-required'; status: number; body: UpstreamEnvelope }
  /** The source answered: `errors` when the mutation failed there. */
  | { kind: 'ran'; data?: unknown; errors?: unknown[] };

export interface ViewActionService {
  invoke(viewId: string, action: string, body: InvokeActionBody): Promise<ActionOutcome>;
}

/** Largest answer kept in the log; a bigger one is logged as its size. */
export const MAX_LOGGED_RESULT_BYTES = 8 * 1024;

/** Variables the document declares; throws unless it is exactly one mutation operation. */
export function declaredMutationVariables(document: string): Set<string> {
  const operations = parse(document).definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  const [only] = operations;
  if (operations.length !== 1 || only.operation !== OperationTypeNode.MUTATION) throw new Error('An action runs exactly one mutation');
  return new Set((only.variableDefinitions ?? []).map((v) => v.variable.name.value));
}

/** What the log keeps of an answer. */
export function loggedResult(body: UpstreamEnvelope): unknown {
  const bytes = Buffer.byteLength(JSON.stringify(body));
  return bytes <= MAX_LOGGED_RESULT_BYTES ? body : { truncated: true, bytes, errors: body.errors?.length ?? 0 };
}

const isAuthRequired = (body: UpstreamEnvelope) =>
  body.errors?.some((e) => (e as { extensions?: { code?: unknown } }).extensions?.code === AUTH_REQUIRED_CODE) ?? false;

export function createViewActionService(deps: {
  views: ViewReader;
  sources: Pick<SourceService, 'get' | 'runGraphql'>;
  log: ActionLog;
}): ViewActionService {
  return {
    async invoke(viewId, key, body) {
      const raw = await deps.views.getSpec(viewId);
      if (raw === null) return { kind: 'view-not-found' };
      const spec = viewSpecSchema.safeParse(raw);
      if (!spec.success) return { kind: 'invalid', error: 'The stored view spec is invalid' };
      const actions = spec.data.actions ?? {};
      if (!Object.hasOwn(actions, key)) return { kind: 'action-not-found' };
      const source = await deps.sources.get(body.sourceId);
      if (!source) return { kind: 'source-not-found' };
      if (!source.allowWrites) return { kind: 'writes-disabled' };

      const action = actions[key];
      let declared: Set<string>;
      try {
        declared = declaredMutationVariables(action.mutation);
      } catch (err) {
        return { kind: 'invalid', error: err instanceof Error ? err.message : 'Invalid mutation' };
      }
      const variables = Object.fromEntries(Object.entries(body.variables ?? {}).filter(([name]) => declared.has(name)));
      const res = await deps.sources.runGraphql(body.sourceId, { query: action.mutation, variables });
      if (!res) return { kind: 'source-not-found' };
      const ok = res.status < 400 && !(res.body.errors?.length ?? 0);
      await deps.log.record({ viewId, action: key, sourceId: body.sourceId, variables, ok, result: loggedResult(res.body) });
      if (isAuthRequired(res.body)) return { kind: 'auth-required', status: res.status, body: res.body };
      return {
        kind: 'ran',
        ...(res.body.data !== undefined ? { data: res.body.data } : {}),
        ...(res.body.errors ? { errors: res.body.errors } : {}),
      };
    },
  };
}
