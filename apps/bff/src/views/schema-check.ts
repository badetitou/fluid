import { buildClientSchema, getIntrospectionQuery, parse, printSchema, validate, type GraphQLSchema, type IntrospectionQuery } from 'graphql';
import type { QuerySpec } from '@fluid/shared';
import type { SourceService } from '../sources/service';

// Checks a draft's queries against the source's GraphQL schema, read once by introspection.

export interface SourceSchema {
  schema: GraphQLSchema;
  /** Root mutation fields, to check a draft's actions. */
  mutationFields: string[];
}
export type SchemaLookup = (sourceId: string) => Promise<SourceSchema | { error: string }>;

/** Issues reported per draft at most (the model reads them). */
const MAX_ISSUES = 12;

/** Validation issues of each query (plugin data sources are not GraphQL and are skipped). */
export function checkQueries(schema: GraphQLSchema, queries: Record<string, QuerySpec>): string[] {
  const issues: string[] = [];
  for (const [name, q] of Object.entries(queries)) {
    if (q.source) continue;
    try {
      for (const e of validate(schema, parse(q.query))) issues.push(`queries.${name}: ${e.message}`);
    } catch (err) {
      issues.push(`queries.${name}: ${err instanceof Error ? err.message : 'parse error'}`);
    }
  }
  return issues.slice(0, MAX_ISSUES);
}

/** Builds the schema from an introspection answer, or says why it cannot. */
export function schemaFromIntrospection(body: { data?: unknown; errors?: unknown[] }): SourceSchema | { error: string } {
  if (!body.data || (body.errors?.length ?? 0) > 0) return { error: 'the source refused the introspection query' };
  try {
    const schema = buildClientSchema(body.data as IntrospectionQuery);
    return { schema, mutationFields: Object.keys(schema.getMutationType()?.getFields() ?? {}) };
  } catch {
    return { error: 'the introspection answer is not a usable schema' };
  }
}

/** Introspects a source through the sources service, keeping each schema for `ttlMs`. Failures are not kept. */
export function createSchemaLookup(
  sources: Pick<SourceService, 'runGraphql'>,
  ttlMs = 5 * 60_000,
  now: () => number = Date.now,
): SchemaLookup {
  const cache = new Map<string, { at: number; value: SourceSchema }>();
  const query = getIntrospectionQuery({ descriptions: false });
  return async (sourceId) => {
    const hit = cache.get(sourceId);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const res = await sources.runGraphql(sourceId, { query });
    if (!res) return { error: 'source not found' };
    const value = schemaFromIntrospection(res.body);
    if ('schema' in value) cache.set(sourceId, { at: now(), value });
    return value;
  };
}

/** Largest SDL handed to an assistant; the rest is cut (types come in schema order). */
export const MAX_SDL_CHARS = 60_000;

/** The schema as SDL, for an assistant writing queries; cut at `max` characters. */
export function schemaSdl(schema: GraphQLSchema, max = MAX_SDL_CHARS): { sdl: string; truncated: boolean } {
  const sdl = printSchema(schema);
  return sdl.length <= max ? { sdl, truncated: false } : { sdl: sdl.slice(0, max), truncated: true };
}
