import { useCallback, useMemo, useState } from 'react';
import { GRAPH_CONCEPT } from '@fluid/shared';
import { useConcept, useConceptsByName } from '../../../hooks/useConcepts';
import { walkSchema } from './model';

/**
 * A walk through the schema from the root Query, introspecting each concept as
 * the walk reaches it. Starts along `initial` (a dot path split in segments),
 * so the graph opens on the concept a path currently points to.
 */
export function useSchemaWalk(initial: string[]) {
  const [segments, setSegments] = useState(initial);
  const { concept: root } = useConcept(GRAPH_CONCEPT);
  const [names, setNames] = useState<string[]>([]);
  const byName = useConceptsByName(names);

  const walk = useMemo(() => {
    const lookup = (name: string) => (name === GRAPH_CONCEPT ? (root ?? undefined) : byName.get(name));
    return walkSchema(GRAPH_CONCEPT, segments, lookup);
  }, [segments, root, byName]);

  // Introspect every concept the walk reaches, keeping those already met for the way back.
  const missing = walk.types.slice(1).filter((n) => !names.includes(n));
  if (missing.length > 0) setNames([...names, ...missing]);

  const focusType = walk.types[walk.types.length - 1];
  const focus = focusType === GRAPH_CONCEPT ? (root ?? undefined) : byName.get(focusType);

  /** Walks on along a relation of the focus. */
  const enter = useCallback((field: string) => setSegments([...walk.walked, field]), [walk.walked]);
  /** Walks back to the concept reached after `depth` relations. */
  const back = useCallback((depth: number) => setSegments(walk.walked.slice(0, depth)), [walk.walked]);

  return { walk, focus, loading: walk.loading || !focus, enter, back };
}
