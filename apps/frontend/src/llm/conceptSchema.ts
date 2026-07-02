import type { Concept } from '../graphql/introspection';
import type { ConceptSchemaPayload } from '../bff/client';

/**
 * Build the compact concept schema the BFF needs to prompt the LLM (and to
 * build the deterministic mock): the concept's fields, its list/by-id queries,
 * and a shallow view of related concepts.
 */
export function buildConceptSchemaPayload(
  concept: Concept,
  conceptByName: Map<string, Concept>,
): ConceptSchemaPayload {
  const seen = new Set<string>();
  const related: NonNullable<ConceptSchemaPayload['related']> = [];
  for (const rf of concept.relationFields) {
    if (seen.has(rf.typeName)) continue;
    seen.add(rf.typeName);
    const target = conceptByName.get(rf.typeName);
    related.push({
      name: rf.typeName,
      fields: target ? target.scalarFields.slice(0, 6).map((f) => f.name) : undefined,
    });
  }

  return {
    name: concept.name,
    description: concept.description,
    listQuery: concept.queries.list?.field ?? null,
    byIdQuery: concept.queries.byId?.field ?? null,
    fields: concept.fields.map((f) => ({
      name: f.name,
      typeName: f.typeName,
      typeKind: f.typeKind,
      isList: f.isList,
      isScalar: f.isScalar,
      description: f.description,
    })),
    related,
  };
}

/** Trim empty override fields so the BFF falls back to its env defaults. */
export function toConfigOverrides(settings: {
  provider: 'openai' | 'ollama' | 'mock';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}) {
  const overrides: {
    provider: 'openai' | 'ollama' | 'mock';
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  } = { provider: settings.provider };
  if (settings.model?.trim()) overrides.model = settings.model.trim();
  if (settings.apiKey?.trim()) overrides.apiKey = settings.apiKey.trim();
  if (settings.baseUrl?.trim()) overrides.baseUrl = settings.baseUrl.trim();
  return overrides;
}
