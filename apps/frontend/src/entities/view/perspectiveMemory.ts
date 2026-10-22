import { create } from 'zustand';

interface PerspectiveMemoryState {
  /** Column slot (position, concept, list or item) -> key of the perspective last shown there. */
  bySlot: Record<string, string>;
  remember: (slot: string, key: string | undefined) => void;
}

/**
 * The perspective last picked at each Miller position, for this session: a
 * column reopened at the same place starts on it instead of the default.
 */
export const usePerspectiveMemory = create<PerspectiveMemoryState>()((set) => ({
  bySlot: {},
  remember: (slot, key) => set((s) => ({ bySlot: rememberPick(s.bySlot, slot, key) })),
}));

/** `bySlot` with `key` remembered for `slot` (forgotten when undefined). */
export function rememberPick(bySlot: Record<string, string>, slot: string, key: string | undefined): Record<string, string> {
  if (bySlot[slot] === key) return bySlot;
  const next = { ...bySlot };
  if (key === undefined) delete next[slot];
  else next[slot] = key;
  return next;
}
