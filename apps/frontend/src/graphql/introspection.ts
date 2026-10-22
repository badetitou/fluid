// Progressive introspection: instead of one deep `__schema` query (rejected by
// sources that enforce a query depth limit), we only read the root Query type
// up front, then introspect each concept's type on demand with `__type(name:)`.
// Concepts are the object types a user can explore, each with its scalar
// fields, relations, and the root Query fields that return it (list / by-id).

import type { Concept, ConceptField, ConceptMutations, ConceptQueries, IntrospectionField, IntrospectionType } from './introspectionTypes';
import { typeRefToString, unwrapType } from './introspectionTypes';

export * from './introspectionQueries';
export * from './introspectionTypes';
export * from './mutations';

const LEAF_KINDS = new Set(['SCALAR', 'ENUM']);
const ROOT_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription']);

const LIMIT_ARGS = ['take', 'first', 'limit', 'pageSize', 'size'];
// Preferred names for the rows field of a pagination wrapper, in order.
const ITEMS_FIELDS = ['results', 'items', 'nodes', 'data', 'records', 'list'];

/**
 * The key argument of a single-item root field: `id` when only it is required,
 * otherwise its sole required scalar argument (e.g. `country(code: ID!)`).
 */
function byIdKeyArg(field: IntrospectionField): IntrospectionField['args'][number] | undefined {
  const required = field.args.filter((a) => a.type?.kind === 'NON_NULL');
  const idArg = field.args.find((a) => a.name === 'id');
  if (idArg && required.every((a) => a.name === 'id')) return idArg;
  if (required.length !== 1) return undefined;
  const rendered = typeRefToString(required[0].type);
  return rendered?.startsWith('[') ? undefined : required[0];
}

/** Name of the field identifying an item for its by-id query (`id` unless stated). */
export function keyFieldOf(queries: ConceptQueries | undefined): string {
  return queries?.byId?.idArg ?? 'id';
}

function hasRequiredArgs(field: IntrospectionField, except: string[] = []): boolean {
  return field.args.some((a) => a.type?.kind === 'NON_NULL' && !except.includes(a.name));
}

function limitArgOf(field: IntrospectionField): string | undefined {
  return field.args.find((a) => LIMIT_ARGS.includes(a.name))?.name;
}

/**
 * Root fields that may return a pagination wrapper rather than an entity:
 * a single object, callable without arguments and not addressed by id.
 * Maps the wrapper type name to the root field returning it.
 */
export function findWrapperCandidates(rootType: IntrospectionType | null): Map<string, string> {
  const candidates = new Map<string, string>();
  for (const field of rootType?.fields ?? []) {
    const u = unwrapType(field.type);
    if (!u.name || u.kind !== 'OBJECT' || u.isList) continue;
    if (field.args.some((a) => a.name === 'id') || hasRequiredArgs(field)) continue;
    if (!candidates.has(u.name)) candidates.set(u.name, field.name);
  }
  return candidates;
}

/** The rows field of a pagination wrapper type, if it has one. */
export function findItemsField(wrapper: IntrospectionType): { field: string; typeName: string } | null {
  const lists = (wrapper.fields ?? [])
    .map((f) => ({ field: f.name, u: unwrapType(f.type) }))
    .filter(({ u }) => u.isList && u.kind === 'OBJECT' && u.name);
  if (lists.length === 0) return null;
  const preferred =
    ITEMS_FIELDS.map((n) => lists.find((l) => l.field === n)).find(Boolean) ??
    (lists.length === 1 ? lists[0] : undefined);
  return preferred ? { field: preferred.field, typeName: preferred.u.name! } : null;
}

export interface RootQueries {
  /** Explorable concept -> its list / by-id root queries. */
  queriesByType: Map<string, ConceptQueries>;
  /** Pagination wrapper types: plumbing, not concepts of their own. */
  wrapperTypes: Set<string>;
}

/**
 * Map each object type returned by a root Query field to those fields
 * (list / by-id). Only the root type is needed, plus the pagination wrapper
 * types (see `findWrapperCandidates`) once introspected: their rows field
 * becomes the list query of the item type.
 */
export function buildRootQueries(
  rootType: IntrospectionType | null,
  wrappers: Map<string, IntrospectionType> = new Map(),
): RootQueries {
  const queriesByType = new Map<string, ConceptQueries>();
  const wrapperTypes = new Set<string>();
  const entry = (name: string) => {
    const e = queriesByType.get(name) ?? {};
    queriesByType.set(name, e);
    return e;
  };

  for (const field of rootType?.fields ?? []) {
    const u = unwrapType(field.type);
    if (!u.name || u.kind !== 'OBJECT') continue;
    if (u.name.startsWith('__') || ROOT_TYPE_NAMES.has(u.name)) continue;

    if (u.isList) {
      // A list needing arguments (e.g. `charactersByIds(ids: [ID!]!)`) cannot
      // back a work list on its own.
      if (hasRequiredArgs(field)) continue;
      const e = entry(u.name);
      if (!e.list || e.list.itemsPath) e.list = { field: field.name, limitArg: limitArgOf(field) };
      continue;
    }

    const wrapper = wrappers.get(u.name);
    const items = wrapper && !field.args.some((a) => a.name === 'id') ? findItemsField(wrapper) : null;
    if (items) {
      wrapperTypes.add(u.name);
      const e = entry(items.typeName);
      e.list ??= { field: field.name, itemsPath: items.field, limitArg: limitArgOf(field) };
      continue;
    }

    const keyArg = byIdKeyArg(field);
    if (keyArg) {
      entry(u.name).byId = {
        field: field.name,
        ...(keyArg.name !== 'id' ? { idArg: keyArg.name } : {}),
        idType: typeRefToString(keyArg.type),
      };
    } else if (!hasRequiredArgs(field)) {
      // Kept as an explorable concept even without a usable list / by-id query.
      entry(u.name);
    }
  }

  for (const name of wrapperTypes) {
    const e = queriesByType.get(name);
    if (e && !e.list && !e.byId) queriesByType.delete(name);
  }
  return { queriesByType, wrapperTypes };
}

/** Build one concept from its introspected type; null when it is not an explorable object. */
export function buildConcept(
  type: IntrospectionType | null,
  queries: ConceptQueries = {},
  mutations?: ConceptMutations,
): Concept | null {
  if (!type?.name || type.kind !== 'OBJECT') return null;
  if (type.name.startsWith('__') || ROOT_TYPE_NAMES.has(type.name)) return null;

  const fields: ConceptField[] = (type.fields ?? []).map((f) => {
    const u = unwrapType(f.type);
    return {
      name: f.name,
      description: f.description,
      typeName: u.name ?? 'Unknown',
      typeKind: u.kind,
      isList: u.isList,
      isScalar: LEAF_KINDS.has(u.kind),
      hasRequiredArgs: hasRequiredArgs(f),
    };
  });

  return {
    name: type.name,
    description: type.description,
    fields,
    scalarFields: fields.filter((f) => f.isScalar),
    // Fields whose type could not be resolved within the shallow introspection
    // are kept in `fields` but are not offered as navigable relations.
    relationFields: fields.filter((f) => !f.isScalar && f.typeKind !== 'UNKNOWN'),
    queries,
    ...(mutations ? { mutations } : {}),
  };
}
