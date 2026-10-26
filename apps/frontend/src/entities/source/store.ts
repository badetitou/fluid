import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { forgetSource, rememberSource, renameSource, type SavedSource } from './model';

interface SavedSourcesState {
  /** The sources the user connected to or added, in order, with their names. */
  saved: SavedSource[];
  remember: (url: string, name?: string) => void;
  rename: (url: string, name: string) => void;
  forget: (url: string) => void;
}

// Kept per browser, like the connection. Only read and written through `useSources`.
export const useSavedSources = create<SavedSourcesState>()(
  persist(
    (set, get) => ({
      saved: [],
      remember: (url, name) => set({ saved: rememberSource(get().saved, url, name) }),
      rename: (url, name) => set({ saved: renameSource(get().saved, url, name) }),
      forget: (url) => set({ saved: forgetSource(get().saved, url) }),
    }),
    { name: 'fluid-sources' },
  ),
);
