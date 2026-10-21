import { useMemo } from 'react';
import { useConceptsByName, type Concept } from '../../hooks/useConcepts';
import { buildConceptSchemaPayload } from '../../llm/conceptSchema';

/**
 * A concept's related types, introspected one level ahead, and the compact
 * schema the LLM is prompted with.
 */
export function useConceptSchema(concept: Concept) {
  const relatedNames = useMemo(
    () => [...new Set(concept.relationFields.map((f) => f.typeName))],
    [concept],
  );
  const conceptByName = useConceptsByName(relatedNames);
  const schema = useMemo(
    () => buildConceptSchemaPayload(concept, conceptByName),
    [concept, conceptByName],
  );
  return { relatedNames, conceptByName, schema };
}
