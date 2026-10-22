// GraphQL introspection queries, sized to the depth the source accepts.

export const ROOT_TYPE_QUERY = /* GraphQL */ `
  query FluidRootType {
    __schema {
      queryType {
        name
      }
      mutationType {
        name
      }
    }
  }
`;

/**
 * How far type references are unwrapped. "deep" resolves up to `[X!]!` (and
 * typed arguments such as `id: Int!`); sources enforcing a query depth limit
 * reject it, so we fall back to "shallow" (depth 4): one `ofType` hop resolves
 * `X`, `X!`, `[X]` and `[X]!`, while deeper wrappers surface as an unknown type
 * rather than failing the whole query.
 */
export type IntrospectionDepth = 'deep' | 'shallow';

const TYPE_REF: Record<IntrospectionDepth, string> = {
  deep: 'kind name ofType { kind name ofType { kind name ofType { kind name } } }',
  shallow: 'kind name ofType { kind name }',
};
const ARG_TYPE_REF: Record<IntrospectionDepth, string> = {
  deep: 'kind name ofType { kind name ofType { kind name } }',
  shallow: 'kind name',
};

function typeSelection(depth: IntrospectionDepth): string {
  return `kind
      name
      description
      fields(includeDeprecated: false) {
        name
        description
        args {
          name
          type { ${ARG_TYPE_REF[depth]} }
        }
        type { ${TYPE_REF[depth]} }
      }`;
}

const TYPE_QUERIES: Record<IntrospectionDepth, string> = {
  deep: `query FluidTypeDeep($name: String!) {
    __type(name: $name) {
      ${typeSelection('deep')}
    }
  }`,
  shallow: `query FluidType($name: String!) {
    __type(name: $name) {
      ${typeSelection('shallow')}
    }
  }`,
};

/** Introspection of one type's fields, at the given depth. */
export function typeQuery(depth: IntrospectionDepth): string {
  return TYPE_QUERIES[depth];
}

/**
 * One aliased query introspecting several types' fields at once (used for the
 * pagination wrappers returned by root fields). Null when there is nothing to ask.
 */
export function buildWrapperTypesQuery(
  names: string[],
  depth: IntrospectionDepth = 'shallow',
): string | null {
  if (names.length === 0) return null;
  const parts = names.map(
    (name, i) => `t${i}: __type(name: ${JSON.stringify(name)}) {
      ${typeSelection(depth)}
    }`,
  );
  return `query FluidWrapperTypes {\n    ${parts.join('\n    ')}\n  }`;
}

const INPUT_TYPE_QUERIES: Record<IntrospectionDepth, string> = {
  deep: `query FluidInputTypeDeep($name: String!) {
    __type(name: $name) {
      kind
      name
      inputFields {
        name
        description
        type { ${TYPE_REF.deep} }
      }
    }
  }`,
  shallow: `query FluidInputType($name: String!) {
    __type(name: $name) {
      kind
      name
      inputFields {
        name
        description
        type { ${TYPE_REF.shallow} }
      }
    }
  }`,
};

/** Introspection of an input object type's fields (a mutation's `input` argument), at the given depth. */
export function inputTypeQuery(depth: IntrospectionDepth): string {
  return INPUT_TYPE_QUERIES[depth];
}
