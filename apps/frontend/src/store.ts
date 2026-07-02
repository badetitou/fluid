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

interface PreferencesState {
  navbarSide: NavbarSide;
  setNavbarSide: (side: NavbarSide) => void;
  toggleNavbarSide: () => void;
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
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () =>
        set({ themeMode: get().themeMode === 'light' ? 'dark' : 'light' }),
    }),
    { name: 'fluid-preferences' },
  ),
);

export type LlmProvider = 'openai' | 'ollama' | 'mock';

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
