import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { forgetSource, rememberSource, renameSource, setBffSourceId, type SavedSource } from './model';
import { parseSavedSettings, updateSettings, type SourceSettings } from './settings';

interface SavedSourcesState {
  /** The sources the user connected to or added, in order, with their names. */
  saved: SavedSource[];
  remember: (url: string, name?: string) => void;
  rename: (url: string, name: string) => void;
  forget: (url: string) => void;
  /** Routes a source through the BFF config `id`, or back to a direct connection (`undefined`). */
  setBffId: (url: string, id: string | undefined) => void;
}

// Kept per browser, like the connection. Only read and written through `useSources`.
export const useSavedSources = create<SavedSourcesState>()(
  persist(
    (set, get) => ({
      saved: [],
      remember: (url, name) => set({ saved: rememberSource(get().saved, url, name) }),
      rename: (url, name) => set({ saved: renameSource(get().saved, url, name) }),
      forget: (url) => set({ saved: forgetSource(get().saved, url) }),
      setBffId: (url, id) => set({ saved: setBffSourceId(get().saved, url, id) }),
    }),
    { name: 'fluid-sources' },
  ),
);

interface SourceSettingsState {
  /** GraphQL source URL -> the user's row settings for it. */
  byUrl: Record<string, SourceSettings>;
  update: (url: string, change: Partial<SourceSettings>) => void;
}

// Per source, like the write access: each server pages its lists its own way.
// Only read and written through `useSourceSettings`.
export const useSourceSettingsStore = create<SourceSettingsState>()(
  persist(
    (set, get) => ({
      byUrl: {},
      update: (url, change) => set({ byUrl: { ...get().byUrl, [url]: updateSettings(get().byUrl[url], change) } }),
    }),
    {
      name: 'fluid-source-settings',
      // Read back from the browser: checked like any incoming data.
      merge: (saved, current) => ({
        ...current,
        byUrl: parseSavedSettings((saved as { byUrl?: unknown } | undefined)?.byUrl),
      }),
    },
  ),
);
