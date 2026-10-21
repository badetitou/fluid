import { GRAPH_CONCEPT } from '@fluid/shared';
import { buildConcept } from './introspection';
import type { Concept, IntrospectionType } from './introspectionTypes';

/**
 * The whole graph as a pseudo-concept: the root Query type's fields, under the
 * reserved `@graph` name, so a graph dashboard opens like any concept column.
 */
export function buildGraphConcept(rootType: IntrospectionType | null): Concept | null {
  const concept = rootType ? buildConcept({ ...rootType, name: GRAPH_CONCEPT }) : null;
  return concept && { ...concept, description: 'Dashboards querying the whole graph' };
}
