import { useMemo } from 'react';
import { isGraphConcept } from '@fluid/shared';
import { useConceptsByName, useRootConcepts, type Concept } from '../../hooks/useConcepts';
import { buildConceptSchemaPayload, buildEntryPoints } from '../../llm/conceptSchema';
import { nextLevelNames } from '../../views/hierarchy';

/**
 * A concept's related types, introspected one level ahead (two along list
 * relations, to follow container chains), and the compact schema the LLM is
 * prompted with (plus the graph's entry points for a whole-graph dashboard).
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
  // A whole-graph dashboard may start from any root query: list them all.
  const { queriesByType } = useRootConcepts();
  const schema = useMemo(() => {
    const payload = buildConceptSchemaPayload(concept, conceptByName);
    return isGraphConcept(concept.name)
      ? { ...payload, entryPoints: buildEntryPoints(queriesByType, conceptByName) }
      : payload;
  }, [concept, conceptByName, queriesByType]);
  return { relatedNames, conceptByName, schema };
}
