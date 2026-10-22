import { useMemo } from 'react';
import { useQuery } from 'urql';
import {
  buildRootMutations,
  typeQuery,
  type ConceptMutations,
  type IntrospectionDepth,
  type TypeResult,
} from '../../graphql/introspection';

const NO_MUTATIONS = new Map<string, ConceptMutations>();

/**
 * Introspects the root Mutation type, when the source has one, and attaches its
 * fields to the concepts they write (see docs/architecture/MUTATIONS.md §4).
 * A source without mutations, or whose Mutation type cannot be read, has none:
 * it stays read-only, which is never an error.
 */
export function useRootMutations(
  mutationTypeName: string | undefined,
  depth: IntrospectionDepth,
  concepts: ReadonlySet<string>,
): { mutationsByType: Map<string, ConceptMutations>; fetching: boolean } {
  const [result] = useQuery<TypeResult>({
    query: typeQuery(depth),
    variables: { name: mutationTypeName ?? '' },
    pause: !mutationTypeName,
  });
  const mutationType = result.data?.__type ?? null;
  const mutationsByType = useMemo(
    () => (mutationType ? buildRootMutations(mutationType, concepts) : NO_MUTATIONS),
    [mutationType, concepts],
  );
  return { mutationsByType, fetching: result.fetching };
}
