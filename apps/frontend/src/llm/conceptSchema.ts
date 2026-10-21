import type { Concept, ConceptQueries } from '../graphql/introspection';
import type { ConceptSchemaPayload, EntryPointPayload, LlmProvider, RelationPathPayload } from '../bff/client';

/** How many relation hops below the concept the LLM is told about. */
export const RELATION_PATH_DEPTH = 3;
/** Cap on reachable relations so wide schemas keep the prompt compact. */
const MAX_RELATION_PATHS = 40;
const MAX_PATH_FIELDS = 12;

/**
 * Walk the relation graph breadth-first from the concept, up to `maxDepth`
 * hops, so a view can select and display data several levels deep (e.g.
 * Customer → accounts → transactions). A type already on the current path is
 * not re-entered, which skips back-references and cycles. A relation from a
 * type to itself (commit → parentCommits, folder → children) is listed, marked
 * `recursive`, but not walked: version histories and hierarchies need it.
 */
export function buildRelationPaths(
  concept: Concept,
  conceptByName: Map<string, Concept>,
  maxDepth = RELATION_PATH_DEPTH,
): RelationPathPayload[] {
  const out: RelationPathPayload[] = [];
  let frontier = [{ concept, path: '', isList: false, ancestors: new Set([concept.name]) }];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth += 1) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const rf of node.concept.relationFields) {
        const recursive = rf.typeName === node.concept.name;
        if (rf.hasRequiredArgs || (node.ancestors.has(rf.typeName) && !recursive)) continue;
        const target = conceptByName.get(rf.typeName);
        if (!target) continue;
        if (out.length >= MAX_RELATION_PATHS) return out;
        const path = node.path ? `${node.path}.${rf.name}` : rf.name;
        const isList = node.isList || rf.isList;
        out.push({
          path,
          typeName: rf.typeName,
          isList,
          fields: target.scalarFields
            .filter((f) => !f.hasRequiredArgs)
            .slice(0, MAX_PATH_FIELDS)
            .map((f) => `${f.name}: ${f.typeName}${f.isList ? '[]' : ''}`),
          ...(recursive && { recursive: true }),
        });
        if (!recursive) next.push({ concept: target, path, isList, ancestors: new Set([...node.ancestors, rf.typeName]) });
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Build the compact concept schema the BFF needs to prompt the LLM (and to
 * build the deterministic mock): the concept's fields, its list/by-id queries,
 * a shallow view of related concepts and the relations reachable several
 * levels deep.
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
    listItemsPath: concept.queries.list?.itemsPath ?? null,
    listLimitArg: concept.queries.list?.limitArg ?? null,
    byIdQuery: concept.queries.byId?.field ?? null,
    byIdArgName: concept.queries.byId?.idArg ?? null,
    byIdArgType: concept.queries.byId?.idType ?? null,
    fields: concept.fields.map((f) => ({
      name: f.name,
      typeName: f.typeName,
      typeKind: f.typeKind,
      isList: f.isList,
      isScalar: f.isScalar,
      description: f.description,
    })),
    related,
    paths: buildRelationPaths(concept, conceptByName),
  };
}

/**
 * Every concept readable from the root of the graph, with its root queries and
 * scalar fields: what a whole-graph dashboard may start its queries from.
 */
export function buildEntryPoints(
  queriesByType: Map<string, ConceptQueries>,
  conceptByName: Map<string, Concept>,
): EntryPointPayload[] {
  return [...queriesByType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, queries]) => ({
      concept: name,
      listQuery: queries.list?.field ?? null,
      listItemsPath: queries.list?.itemsPath ?? null,
      listLimitArg: queries.list?.limitArg ?? null,
      byIdQuery: queries.byId?.field ?? null,
      byIdArgName: queries.byId?.idArg ?? null,
      byIdArgType: queries.byId?.idType ?? null,
      fields: (conceptByName.get(name)?.scalarFields ?? [])
        .filter((f) => !f.hasRequiredArgs)
        .slice(0, MAX_PATH_FIELDS)
        .map((f) => `${f.name}: ${f.typeName}${f.isList ? '[]' : ''}`),
    }));
}

/** Trim empty override fields so the BFF falls back to its env defaults. */
export function toConfigOverrides(settings: {
  provider: LlmProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}) {
  const overrides: {
    provider: LlmProvider;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  } = { provider: settings.provider };
  if (settings.model?.trim()) overrides.model = settings.model.trim();
  // Claude Code authenticates with the local CLI login: no key or URL to forward.
  if (settings.provider === 'claude-code') return overrides;
  if (settings.apiKey?.trim()) overrides.apiKey = settings.apiKey.trim();
  if (settings.baseUrl?.trim()) overrides.baseUrl = settings.baseUrl.trim();
  return overrides;
}
