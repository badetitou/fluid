import { useRootConcepts } from '../../entities/concept';
import { shownNavSections, useActiveNavSections } from '../../entities/plugin';

/** The nav sections of the enabled plugins that fit the connected source, and its root concepts. */
export function useShownNavSections() {
  const { queriesByType } = useRootConcepts();
  const active = useActiveNavSections();
  return { sections: shownNavSections(active, queriesByType), queriesByType };
}
