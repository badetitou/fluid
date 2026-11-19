import { parse, Kind, OperationTypeNode } from 'graphql';
import { z } from 'zod';
import type { QuerySpec } from '@fluid/shared';

export const MAX_TAKE = 10_000;
/** Serialized size cap of the request variables. */
export const MAX_VARIABLES_BYTES = 64 * 1024;

/** Body of `POST /api/views/:id/run`. No field carries query text: only stored queries run. */
export const runViewBody = z.strictObject({
  sourceId: z.string().min(1),
  variables: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= MAX_VARIABLES_BYTES, 'variables are too large')
    .optional(),
  take: z.number().int().min(1).max(MAX_TAKE).optional(),
});
export type RunViewBody = z.infer<typeof runViewBody>;

export class NotARead extends Error {}

/**
 * Names of the variables declared by the stored document, which must be exactly one `query`
 * operation (a stored mutation or subscription must never run with the source credentials).
 * Throws NotARead for anything else and a GraphQL syntax error for an unparsable document.
 */
export function declaredVariables(query: string): Set<string> {
  const operations = parse(query).definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  const [only] = operations;
  if (operations.length !== 1 || only.operation !== OperationTypeNode.QUERY) {
    throw new NotARead('Only a single query operation can run');
  }
  return new Set((only.variableDefinitions ?? []).map((v) => v.variable.name.value));
}

/**
 * The query's own variables, overridden by the request's, restricted to the declared ones.
 * `take` only comes from the request's `take` (a `take` in `variables` is dropped) and is bounded.
 */
export function buildVariables(
  spec: QuerySpec,
  declared: ReadonlySet<string>,
  body: Pick<RunViewBody, 'variables' | 'take'>,
): Record<string, unknown> {
  const { take: _ignored, ...requested } = body.variables ?? {};
  const merged: Record<string, unknown> = { ...spec.variables, ...requested };
  if (body.take !== undefined) merged.take = body.take;
  const vars: Record<string, unknown> = {};
  for (const name of declared) if (name in merged) vars[name] = merged[name];
  if (typeof vars.take === 'number') vars.take = Math.min(Math.max(vars.take, 1), MAX_TAKE);
  return vars;
}
