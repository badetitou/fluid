import { useCallback, useState } from 'react';
import { draftViewEntry, type ColumnPerspectives, type ViewEntry } from '../../entities/view';

/**
 * A view being created in a column: a blank "New view" pill, selected, until
 * an editor saves it or another perspective is picked.
 */
export function useNewView(perspectives: ColumnPerspectives, concept: string) {
  const [draft, setDraft] = useState<ViewEntry | null>(null);
  const { columnKind, pick: pickPerspective } = perspectives;

  const start = useCallback(() => setDraft(draftViewEntry(concept, columnKind)), [concept, columnKind]);
  const pick = useCallback(
    (key: string | undefined) => {
      setDraft(null);
      pickPerspective(key);
    },
    [pickPerspective],
  );

  const shown: ColumnPerspectives = draft
    ? { ...perspectives, entries: [...perspectives.entries, draft], selected: draft, spec: draft.spec, pick }
    : { ...perspectives, pick };
  return { perspectives: shown, start };
}
