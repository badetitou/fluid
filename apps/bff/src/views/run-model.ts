import { parse, Kind } from 'graphql';
import { z } from 'zod';
import type { QuerySpec } from '@fluid/shared';

/** Body of `POST /api/views/:id/run`. No field carries query text: only stored queries run. */
export const runViewBody = z.strictObject({
  sourceId: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional(),
  take: z.number().int().positive().max(10_000).optional(),
});
export type RunViewBody = z.infer<typeof runViewBody>;

/** Names of the variables an operation declares; throws on a document that does not parse. */
export function declaredVariables(query: string): Set<string> {
  const names = new Set<string>();
  for (const def of parse(query).definitions) {
    if (def.kind !== Kind.OPERATION_DEFINITION) continue;
    for (const v of def.variableDefinitions ?? []) names.add(v.variable.name.value);
  }
  return names;
}

/** The query's own variables, overridden by the request's; `take` fills `$take` when declared. */
export function buildVariables(
  spec: QuerySpec,
  declared: ReadonlySet<string>,
  body: Pick<RunViewBody, 'variables' | 'take'>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = { ...spec.variables, ...body.variables };
  if (body.take !== undefined && declared.has('take')) vars.take = body.take;
  return vars;
}
