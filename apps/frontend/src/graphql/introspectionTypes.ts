// Shapes of introspection results and of the concepts built from them.

export interface TypeRef {
  kind: string;
  name: string | null;
  ofType?: TypeRef | null;
}

export interface IntrospectionField {
  name: string;
  description: string | null;
  /** The arg type is only present when introspected with `typeQuery`. */
  args: { name: string; type?: TypeRef }[];
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
  /**
   * Single-item query. `idArg` names its key argument when it is not `id`
   * (e.g. `country(code: ID!)`); `idType` is that argument's GraphQL type
   * (e.g. "Int!"), when introspected.
   */
  byId?: { field: string; idArg?: string; idType?: string };
}

export interface Concept {
  name: string;
  description: string | null;
  fields: ConceptField[];
  scalarFields: ConceptField[];
  relationFields: ConceptField[];
  queries: ConceptQueries;
}
