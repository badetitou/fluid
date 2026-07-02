// Introspection query + helpers that turn a GraphQL schema into "concepts":
// the object types a user can explore, each with its scalar fields, relations,
// and the root Query fields that return it (list / by-id).

export const INTROSPECTION_QUERY = /* GraphQL */ `
  query FluidIntrospection {
    __schema {
      queryType {
        name
      }
      types {
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
            ...TypeRef
          }
        }
      }
    }
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
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
      }
    }
  }
`;

export interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef | null;
}

export interface IntrospectionField {
  name: string;
  description: string | null;
  args: { name: string }[];
  type: TypeRef;
}

export interface IntrospectionType {
  kind: string;
  name: string | null;
  description: string | null;
  fields: IntrospectionField[] | null;
}

export interface IntrospectionSchema {
  __schema: {
    queryType: { name: string } | null;
    types: IntrospectionType[];
  };
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
}

export interface ConceptQueries {
  list?: { field: string };
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

export function buildConcepts(schema: IntrospectionSchema): Concept[] {
  const { types, queryType } = schema.__schema;
  const typeByName = new Map<string, IntrospectionType>();
  for (const t of types) {
    if (t.name) typeByName.set(t.name, t);
  }

  // Map each concept to the root Query fields that return it.
  const queriesByType = new Map<string, ConceptQueries>();
  const rootQueryName = queryType?.name ?? 'Query';
  const rootQuery = typeByName.get(rootQueryName);
  for (const field of rootQuery?.fields ?? []) {
    const unwrapped = unwrapType(field.type);
    if (!unwrapped.name) continue;
    const target = typeByName.get(unwrapped.name);
    if (!target || target.kind !== 'OBJECT') continue;
    const entry = queriesByType.get(unwrapped.name) ?? {};
    if (unwrapped.isList) {
      entry.list = { field: field.name };
    } else {
      entry.byId = { field: field.name };
    }
    queriesByType.set(unwrapped.name, entry);
  }

  const concepts: Concept[] = [];
  for (const t of types) {
    if (!t.name) continue;
    if (t.kind !== 'OBJECT') continue;
    if (t.name.startsWith('__')) continue;
    if (ROOT_TYPE_NAMES.has(t.name)) continue;

    const fields: ConceptField[] = (t.fields ?? []).map((f) => {
      const u = unwrapType(f.type);
      return {
        name: f.name,
        description: f.description,
        typeName: u.name ?? 'Unknown',
        typeKind: u.kind,
        isList: u.isList,
        isScalar: LEAF_KINDS.has(u.kind),
      };
    });

    concepts.push({
      name: t.name,
      description: t.description,
      fields,
      scalarFields: fields.filter((f) => f.isScalar),
      relationFields: fields.filter((f) => !f.isScalar),
      queries: queriesByType.get(t.name) ?? {},
    });
  }

  concepts.sort((a, b) => a.name.localeCompare(b.name));
  return concepts;
}
