import { create } from 'zustand';
import type { CopiedWidget } from './model';

interface ClipboardState {
  /** The widget copied last, in this tab. */
  copied: CopiedWidget | undefined;
  set: (copied: CopiedWidget) => void;
}

// Kept for the session only: across tabs and reloads the system clipboard carries the widget.
export const useClipboardStore = create<ClipboardState>()((set) => ({
  copied: undefined,
  set: (copied) => set({ copied }),
}));
