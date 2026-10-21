import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePinning, useRootConcepts } from '../../entities/concept';
import { ConceptIcon } from '../../features/concept-icon';
import { rootPath } from '../../navigation/millerPath';
import { RemovableEntry } from './RemovableEntry';

/**
 * Concept dashboards: every root concept and the pinned ones (which can be
 * unpinned), each opening its work list as a page.
 */
export function useConceptMenuItems() {
  const { concepts } = useRootConcepts();
  const { unpin } = usePinning();

  return useMemo(
    () =>
      concepts.map((concept) => {
        const to = rootPath({ kind: 'column', concept: concept.name });
        return {
          key: `concept:${concept.name}`,
          icon: <ConceptIcon name={concept.name} isRoot={concept.isRoot} />,
          label: concept.isRoot ? (
            <Link to={to}>{concept.name}</Link>
          ) : (
            <RemovableEntry to={to} label={concept.name} removeLabel="Unpin" onRemove={() => unpin(concept.name)} />
          ),
        };
      }),
    [concepts, unpin],
  );
}
