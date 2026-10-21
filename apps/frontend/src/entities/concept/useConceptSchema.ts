import { useMemo } from 'react';
import { useConceptsByName, type Concept } from '../../hooks/useConcepts';
import { buildConceptSchemaPayload } from '../../llm/conceptSchema';
import { nextLevelNames } from '../../views/hierarchy';

/**
 * A concept's related types, introspected one level ahead (two along list
 * relations, to follow container chains), and the compact schema the LLM is
 * prompted with.
 */
export function useConceptSchema(concept: Concept) {
  const relatedNames = useMemo(
    () => [...new Set(concept.relationFields.map((f) => f.typeName))],
    [concept],
  );
  const related = useConceptsByName(relatedNames);
  const secondNames = useMemo(() => nextLevelNames(related, [concept.name]), [related, concept.name]);
  const second = useConceptsByName(secondNames);
  const conceptByName = useMemo(() => new Map([...second, ...related]), [related, second]);
  const schema = useMemo(
    () => buildConceptSchemaPayload(concept, conceptByName),
    [concept, conceptByName],
  );
  return { relatedNames, conceptByName, schema };
}
