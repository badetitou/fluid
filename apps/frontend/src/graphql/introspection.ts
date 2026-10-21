// Progressive introspection: instead of one deep `__schema` query (rejected by
// sources that enforce a query depth limit), we only read the root Query type
// up front, then introspect each concept's type on demand with `__type(name:)`.
// Concepts are the object types a user can explore, each with its scalar
// fields, relations, and the root Query fields that return it (list / by-id).

export const ROOT_TYPE_QUERY = /* GraphQL */ `
  query FluidRootType {
    __schema {
      queryType {
        name
      }
    }
  }
`;

// Kept shallow on purpose (depth 4): a single `ofType` level resolves `X`,
// `X!`, `[X]` and `[X]!`-style wrappers on one hop; deeper wrappers such as
// `[X!]!` surface as an unknown type rather than failing the whole query.
export const TYPE_QUERY = /* GraphQL */ `
  query FluidType($name: String!) {
    __type(name: $name) {
      kind
      name
      description
      fields(includeDeprecated: false) {
        name
        description
        args {
          name
          type {
            kind
            name
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }
  }
`;

/**
 * One aliased query introspecting several types' fields at once (used for the
 * pagination wrappers returned by root fields). Null when there is nothing to ask.
 */
export function buildWrapperTypesQuery(names: string[]): string | null {
  if (names.length === 0) return null;
  const parts = names.map(
    (name, i) => `t${i}: __type(name: ${JSON.stringify(name)}) {
      kind
      name
      description
      fields(includeDeprecated: false) {
        name
        description
        args {
          name
        }
        type {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }`,
  );
  return `query FluidWrapperTypes {\n    ${parts.join('\n    ')}\n  }`;
}

export interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef | null;
}

export interface IntrospectionField {
  name: string;
  description: string | null;
  /** The arg type is only present when introspected with `TYPE_QUERY`. */
  args: { name: string; type?: { kind: string; name: string | null } }[];
  type: TypeRef;
}

export interface IntrospectionType {
  kind: string;
  name: string | null;
  description: string | null;
  fields: IntrospectionField[] | null;
}

export interface RootTypeResult {
  __schema: {
    queryType: { name: string } | null;
  };
}

export interface TypeResult {
  __type: IntrospectionType | null;
}

const LEAF_KINDS = new Set(['SCALAR', 'ENUM']);
const ROOT_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription']);

export interface UnwrappedType {
  name: string | null;
  kind: string;
  isList: boolean;
  nonNull: boolean;
}

export function unwrapType(ref: TypeRef): UnwrappedType {
  let current: TypeRef | null | undefined = ref;
  let isList = false;
  let nonNull = false;
  while (current) {
    if (current.kind === 'LIST') isList = true;
    if (current.kind === 'NON_NULL' && current.ofType == null) nonNull = true;
    if (current.name && !current.ofType) {
      return { name: current.name, kind: current.kind, isList, nonNull };
    }
    if (current.kind === 'NON_NULL' && !isList) nonNull = true;
    current = current.ofType;
  }
  return { name: null, kind: 'UNKNOWN', isList, nonNull };
}

export interface ConceptField {
  name: string;
  description: string | null;
  typeName: string;
  typeKind: string;
  isList: boolean;
  isScalar: boolean;
  /** True when the field cannot be selected without passing some argument. */
  hasRequiredArgs?: boolean;
}

export interface ListQuery {
  /** Root Query field to call. */
  field: string;
  /**
   * Set when the root field returns a pagination wrapper (e.g. `characters`
   * returning `Characters { info, results }`): the wrapper field holding the rows.
   */
  itemsPath?: string;
  /** Argument limiting the number of rows (`take`, `first`, `limit`…), when supported. */
  limitArg?: string;
}

export interface ConceptQueries {
  list?: ListQuery;
  byId?: { field: string };
}

export interface Concept {
  name: string;
  description: string | null;
  fields: ConceptField[];
  scalarFields: ConceptField[];
  relationFields: ConceptField[];
  queries: ConceptQueries;
}

const LIMIT_ARGS = ['take', 'first', 'limit', 'pageSize', 'size'];
// Preferred names for the rows field of a pagination wrapper, in order.
const ITEMS_FIELDS = ['results', 'items', 'nodes', 'data', 'records', 'list'];

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

    if (field.args.some((a) => a.name === 'id') && !hasRequiredArgs(field, ['id'])) {
      entry(u.name).byId = { field: field.name };
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
  };
}
