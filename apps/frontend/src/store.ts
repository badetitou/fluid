import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from './theme';

export type NavbarSide = 'left' | 'right';

interface ConnectionState {
  graphqlUrl: string | null;
  connect: (url: string) => void;
  disconnect: () => void;
}

export const useConnection = create<ConnectionState>()(
  persist(
    (set) => ({
      graphqlUrl: null,
      connect: (url) => set({ graphqlUrl: url.trim() }),
      disconnect: () => set({ graphqlUrl: null }),
    }),
    { name: 'fluid-connection' },
  ),
);

interface PinnedConceptsState {
  /** Pinned concept names, keyed by GraphQL source URL. */
  byUrl: Record<string, string[]>;
  pin: (url: string, concept: string) => void;
  unpin: (url: string, concept: string) => void;
}

// Only the root Query's concepts are listed by default; deeper concepts the user
// discovered while navigating can be pinned to the concept bar.
export const usePinnedConcepts = create<PinnedConceptsState>()(
  persist(
    (set, get) => ({
      byUrl: {},
      pin: (url, concept) => {
        const current = get().byUrl[url] ?? [];
        if (current.includes(concept)) return;
        set({ byUrl: { ...get().byUrl, [url]: [...current, concept] } });
      },
      unpin: (url, concept) => {
        const current = get().byUrl[url] ?? [];
        set({ byUrl: { ...get().byUrl, [url]: current.filter((c) => c !== concept) } });
      },
    }),
    { name: 'fluid-pinned-concepts' },
  ),
);

interface PreferencesState {
  navbarSide: NavbarSide;
  setNavbarSide: (side: NavbarSide) => void;
  toggleNavbarSide: () => void;
  navbarCollapsed: boolean;
  setNavbarCollapsed: (collapsed: boolean) => void;
  toggleNavbarCollapsed: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      navbarSide: 'left',
      setNavbarSide: (side) => set({ navbarSide: side }),
      toggleNavbarSide: () =>
        set({ navbarSide: get().navbarSide === 'left' ? 'right' : 'left' }),
      navbarCollapsed: false,
      setNavbarCollapsed: (collapsed) => set({ navbarCollapsed: collapsed }),
      toggleNavbarCollapsed: () => set({ navbarCollapsed: !get().navbarCollapsed }),
      themeMode:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () =>
        set({ themeMode: get().themeMode === 'light' ? 'dark' : 'light' }),
    }),
    { name: 'fluid-preferences' },
  ),
);

export type LlmProvider = 'openai' | 'ollama' | 'claude-code' | 'mock';

interface LlmSettingsState {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  update: (
    patch: Partial<Pick<LlmSettingsState, 'provider' | 'model' | 'apiKey' | 'baseUrl'>>,
  ) => void;
}

// LLM connection settings live only in the browser (localStorage) and are sent
// to the BFF per request — the API key is never persisted server-side.
export const useLlmSettings = create<LlmSettingsState>()(
  persist(
    (set) => ({
      provider: 'mock',
      model: '',
      apiKey: '',
      baseUrl: '',
      update: (patch) => set(patch),
    }),
    { name: 'fluid-llm-settings' },
  ),
);
