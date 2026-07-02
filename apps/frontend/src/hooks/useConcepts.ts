import { useMemo } from 'react';
import { useQuery } from 'urql';
import {
  INTROSPECTION_QUERY,
  buildConcepts,
  type Concept,
  type IntrospectionSchema,
} from '../graphql/introspection';

export interface UseConceptsResult {
  concepts: Concept[];
  conceptByName: Map<string, Concept>;
  fetching: boolean;
  error?: Error;
  reexecute: () => void;
}

export function useConcepts(): UseConceptsResult {
  const [result, reexecute] = useQuery<IntrospectionSchema>({
    query: INTROSPECTION_QUERY,
  });

  const concepts = useMemo(() => {
    if (!result.data?.__schema) return [];
    return buildConcepts(result.data);
  }, [result.data]);

  const conceptByName = useMemo(() => {
    const map = new Map<string, Concept>();
    for (const concept of concepts) map.set(concept.name, concept);
    return map;
  }, [concepts]);

  return {
    concepts,
    conceptByName,
    fetching: result.fetching,
    error: result.error,
    reexecute: () => reexecute({ requestPolicy: 'network-only' }),
  };
}
