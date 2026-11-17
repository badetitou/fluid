import { useCallback } from 'react';
import { create } from 'zustand';
import { emptyEntry, type ChatEntry } from './chatModel';

interface ChatStoreState {
  /** Column concept -> its chat (conversation, turn in flight, error), kept for the browser session. */
  byConcept: Record<string, ChatEntry>;
  change: (concept: string, change: (e: ChatEntry) => ChatEntry) => void;
}

/** Exported for tests; components go through `useChatEntry`. */
export const useChatStore = create<ChatStoreState>()((set) => ({
  byConcept: {},
  change: (concept, change) =>
    set((s) => ({ byConcept: { ...s.byConcept, [concept]: change(s.byConcept[concept] ?? emptyEntry()) } })),
}));

const EMPTY = emptyEntry();

/** The chat of a concept's columns, and how to change it. */
export function useChatEntry(concept: string) {
  const entry = useChatStore((s) => s.byConcept[concept] ?? EMPTY);
  const write = useChatStore((s) => s.change);
  const change = useCallback((fn: (e: ChatEntry) => ChatEntry) => write(concept, fn), [write, concept]);
  return { entry, change };
}
