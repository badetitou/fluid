import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseBrowserOAuthSettings, type BrowserOAuthSettings, type MemoryToken } from './model';

interface BrowserOAuthSettingsState {
  /** GraphQL source URL -> how to sign in to it from the page (public settings only). */
  byUrl: Record<string, BrowserOAuthSettings>;
  set: (url: string, settings: BrowserOAuthSettings | undefined) => void;
}

// Kept per browser, like the sources. Only read and written through `useBrowserOAuth`.
export const useBrowserOAuthSettings = create<BrowserOAuthSettingsState>()(
  persist(
    (set, get) => ({
      byUrl: {},
      set: (url, settings) => {
        const { [url]: _old, ...rest } = get().byUrl;
        set({ byUrl: settings ? { ...rest, [url]: settings } : rest });
      },
    }),
    {
      name: 'fluid-browser-oauth',
      // Read back from the browser: checked like any incoming data.
      merge: (saved, current) => ({
        ...current,
        byUrl: parseBrowserOAuthSettings((saved as { byUrl?: unknown } | undefined)?.byUrl),
      }),
    },
  ),
);

interface BrowserTokensState {
  /** GraphQL source URL -> its access token. */
  byUrl: Record<string, MemoryToken>;
  set: (url: string, token: MemoryToken | undefined) => void;
}

// In memory only, never persisted: a reload signs out.
export const useBrowserTokens = create<BrowserTokensState>()((set, get) => ({
  byUrl: {},
  set: (url, token) => {
    const { [url]: _old, ...rest } = get().byUrl;
    set({ byUrl: token ? { ...rest, [url]: token } : rest });
  },
}));
