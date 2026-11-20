import type { Concept, ConceptQueries } from '../../../../graphql/introspection';

// Recognises a source serving badetitou/Model's GraphQL schema
// (`crates/model-graphql/schema.graphql`) from its introspected root queries,
// whatever its URL: an `Entity` interface and one `<kind>ByKey(key:)` lookup
// per concrete kind, at least for namespaces, classes and methods.

/** The `Entity` interface every Model concept implements. */
export const MODEL_ENTITY = 'Entity';

/** The by-key lookups a Model source always has: concept → root field. */
const SIGNATURE: Record<string, string> = {
  [MODEL_ENTITY]: 'entityByKey',
  Namespace: 'namespaceByKey',
  Class: 'classByKey',
  Method: 'methodByKey',
};

/** Concepts shown as types (members, inheritance) and as callables (callers, callees). */
export const MODEL_TYPES: ReadonlySet<string> = new Set(['Class', 'Interface', 'Trait', 'Enum', 'Struct']);
export const MODEL_CALLABLES: ReadonlySet<string> = new Set(['Method', 'Constructor', 'Function']);

const byKey = (queries: ConceptQueries | undefined, field: string): boolean =>
  queries?.byId?.field === field && queries.byId.idArg === 'key';

/** The source's schema looks like Model's. */
export function looksLikeModel(queriesByType: Map<string, ConceptQueries>): boolean {
  return Object.entries(SIGNATURE).every(([concept, field]) => byKey(queriesByType.get(concept), field));
}

/**
 * The by-key root field of a Model concept (e.g. `classByKey`), when the
 * concept is a Model entity (it implements `Entity`, once introspected) that
 * can be read by key.
 */
export function modelLookup(concept: Concept, queriesByType: Map<string, ConceptQueries>): string | undefined {
  if (concept.interfaces && !concept.interfaces.includes(MODEL_ENTITY)) return undefined;
  const queries = queriesByType.get(concept.name);
  return queries?.byId?.idArg === 'key' ? queries.byId.field : undefined;
}
