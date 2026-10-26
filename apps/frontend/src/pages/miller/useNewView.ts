import { useCallback, useState } from 'react';
import { draftViewEntry, injectItemId, type ColumnPerspectives, type ViewEntry } from '../../entities/view';

interface Options {
  concept: string;
  /** Drilled-in item of a detail column, and the query reading it. */
  itemId?: string;
  byIdField?: string;
}

/**
 * A view being created in a column: a blank "New view" pill, selected, until
 * an editor saves it or another perspective is picked. It reads the same data
 * as the column's auto perspective, so widgets can be added to it by hand.
 */
export function useNewView(perspectives: ColumnPerspectives, { concept, itemId, byIdField }: Options) {
  const [draft, setDraft] = useState<ViewEntry | null>(null);
  const { columnKind, entries, pick: pickPerspective, show: showPerspective } = perspectives;

  const start = useCallback(() => {
    const auto = entries.find((e) => e.source === 'auto');
    setDraft(draftViewEntry(concept, columnKind, auto?.spec.queries));
  }, [concept, columnKind, entries]);
  const pick = useCallback(
    (key: string | undefined) => {
      setDraft(null);
      pickPerspective(key);
    },
    [pickPerspective],
  );
  const show = useCallback(
    (key: string) => {
      setDraft(null);
      showPerspective(key);
    },
    [showPerspective],
  );

  const shown: ColumnPerspectives = draft
    ? {
        ...perspectives,
        entries: [...entries, draft],
        selected: draft,
        spec: injectItemId(draft.spec, byIdField, itemId),
        pick,
        show,
      }
    : { ...perspectives, pick, show };
  return { perspectives: shown, start };
}
