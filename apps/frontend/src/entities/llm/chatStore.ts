import { useCallback } from 'react';
import { create } from 'zustand';
import { emptyConversation, type Conversation } from './chatModel';

interface ChatStoreState {
  /** Column concept -> its conversation, kept for the browser session (no persistence). */
  byConcept: Record<string, Conversation>;
  update: (concept: string, change: (c: Conversation) => Conversation) => void;
}

const useChatStore = create<ChatStoreState>()((set) => ({
  byConcept: {},
  update: (concept, change) =>
    set((s) => ({ byConcept: { ...s.byConcept, [concept]: change(s.byConcept[concept] ?? emptyConversation()) } })),
}));

const EMPTY = emptyConversation();

/** The conversation of a concept's columns, and how to change it. */
export function useChatConversation(concept: string) {
  const conversation = useChatStore((s) => s.byConcept[concept] ?? EMPTY);
  const write = useChatStore((s) => s.update);
  const update = useCallback((change: (c: Conversation) => Conversation) => write(concept, change), [write, concept]);
  return { conversation, update };
}
