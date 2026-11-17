// Shapes of introspection results and of the concepts built from them.

import type { MutationKind } from '@fluid/shared';

export type { MutationKind };

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
  /** Interfaces an object (or interface) type implements; absent from older results. */
  interfaces?: { name: string | null }[] | null;
  /** Concrete types of an interface or union; null for an object type. */
  possibleTypes?: { name: string | null }[] | null;
}

/** Kinds whose values have fields to select: concepts a user can explore. */
export const COMPOSITE_KINDS: ReadonlySet<string> = new Set(['OBJECT', 'INTERFACE']);

export interface RootTypeResult {
  __schema: {
    queryType: { name: string } | null;
    /** Absent from sources that do not accept writes. */
    mutationType?: { name: string } | null;
  };
}

export interface TypeResult {
  __type: IntrospectionType | null;
}

export interface IntrospectionInputType {
  kind: string;
  name: string | null;
  inputFields: { name: string; description: string | null; type: TypeRef }[] | null;
}

export interface InputTypeResult {
  __type: IntrospectionInputType | null;
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

/** Render a fully resolved type ref as GraphQL (e.g. `Int!`); undefined when truncated. */
export function typeRefToString(ref: TypeRef | null | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.kind === 'NON_NULL') {
    const inner = typeRefToString(ref.ofType);
    return inner ? `${inner}!` : undefined;
  }
  if (ref.kind === 'LIST') {
    const inner = typeRefToString(ref.ofType);
    return inner ? `[${inner}]` : undefined;
  }
  return ref.name ?? undefined;
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
  /** Argument skipping the first rows (`skip`, `offset`), when the list also has a row limit. */
  offsetArg?: string;
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
  /** Root mutations writing this concept; absent when the source has none. */
  mutations?: ConceptMutations;
  /**
   * Set for an interface: the concrete types its values may be (their
   * `__typename`). Fields of a concrete type are read with `... on Type { }`.
   */
  possibleTypes?: string[];
  /** Interfaces this type implements (its supertypes), when the source has any. */
  interfaces?: string[];
}


export interface MutationArg {
  name: string;
  /** Rendered GraphQL type (e.g. `ID!`), undefined when truncated by a shallow introspection. */
  type?: string;
  /** Named type once unwrapped (e.g. `UpdateTodoInput`), when known. */
  typeName?: string;
  required: boolean;
  /** True for an input object argument (the values to write). */
  isInput: boolean;
}

export interface ConceptMutation {
  /** Root Mutation field to call. */
  field: string;
  kind: MutationKind;
  args: MutationArg[];
  /** Argument naming the item to update / delete (`id` unless stated). */
  idArg?: string;
  /** Input object argument carrying the values to write (`input`, `data`…). */
  inputArg?: string;
  /** True when the mutation returns the written item itself (its fields can be selected). */
  returnsConcept: boolean;
}

export interface ConceptMutations {
  create?: ConceptMutation;
  update?: ConceptMutation;
  delete?: ConceptMutation;
  /** Every other mutation of the concept, including extra ones of an already taken kind. */
  others: ConceptMutation[];
}

/** One field of an input object type, as a form would edit it. */
export interface InputField {
  name: string;
  description: string | null;
  /** Rendered GraphQL type (e.g. `Boolean!`), undefined when truncated. */
  type?: string;
  typeName: string;
  typeKind: string;
  isList: boolean;
  required: boolean;
}
