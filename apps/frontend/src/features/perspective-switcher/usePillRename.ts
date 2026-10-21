import { useCallback, useRef, useState } from 'react';
import type { ViewEntry } from '../../entities/view';

/**
 * Inline renaming of a saved perspective's pill. Enter or blur commits,
 * Escape cancels; an empty or unchanged title is ignored.
 */
export function usePillRename(onCommit: (entry: ViewEntry, title: string) => void) {
  const [editing, setEditing] = useState<ViewEntry | null>(null);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);

  // Stable: pills are memoised on it.
  const start = useCallback((entry: ViewEntry) => {
    if (!entry.saved) return;
    cancelled.current = false;
    setDraft(entry.title);
    setEditing(entry);
  }, []);

  const commit = () => {
    const entry = editing;
    setEditing(null);
    if (cancelled.current || !entry) return;
    const title = draft.trim();
    if (title && title !== entry.title) onCommit(entry, title);
  };

  const cancel = () => {
    cancelled.current = true;
  };

  return { renamingKey: editing?.key, draft, setDraft, start, commit, cancel };
}

export type PillRename = ReturnType<typeof usePillRename>;
