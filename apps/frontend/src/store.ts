import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewSpec } from '@fluid/shared';
import type { Density, ThemeMode } from './theme';

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

interface WritableSourcesState {
  /** GraphQL source URL -> whether fluid may send it mutations (off unless set). */
  byUrl: Record<string, boolean>;
  setWritable: (url: string, writable: boolean) => void;
}

// Writing is opt-in per source: a view's actions only run on a source the user
// allowed in the settings (see docs/architecture/MUTATIONS.md §2).
export const useWritableSources = create<WritableSourcesState>()(
  persist(
    (set, get) => ({
      byUrl: {},
      setWritable: (url, writable) => set({ byUrl: { ...get().byUrl, [url]: writable } }),
    }),
    { name: 'fluid-writable-sources' },
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

interface ConceptIconsState {
  /** Icon key per concept name, keyed by GraphQL source URL. */
  byUrl: Record<string, Record<string, string>>;
  setIcon: (url: string, concept: string, icon: string | null) => void;
}

// User-chosen icons for concepts; a missing entry falls back to the default icon.
export const useConceptIcons = create<ConceptIconsState>()(
  persist(
    (set, get) => ({
      byUrl: {},
      setIcon: (url, concept, icon) => {
        const { [concept]: _previous, ...rest } = get().byUrl[url] ?? {};
        set({ byUrl: { ...get().byUrl, [url]: icon ? { ...rest, [concept]: icon } : rest } });
      },
    }),
    { name: 'fluid-concept-icons' },
  ),
);

interface PreferencesState {
  navbarSide: NavbarSide;
  setNavbarSide: (side: NavbarSide) => void;
  toggleNavbarSide: () => void;
  navbarCollapsed: boolean;
  setNavbarCollapsed: (collapsed: boolean) => void;
  toggleNavbarCollapsed: () => void;
  /** Width of the expanded navbar set by dragging its edge; `null` uses the density default. */
  navbarWidth: number | null;
  setNavbarWidth: (width: number | null) => void;
  /** Miller columns shown side by side, set by dragging the pager's window. */
  millerVisibleColumns: number;
  setMillerVisibleColumns: (count: number) => void;
  /** Keys of the navbar sections (concepts, dashboards) currently unfolded. */
  navbarOpenSections: string[];
  setNavbarOpenSections: (keys: string[]) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
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
      navbarWidth: null,
      setNavbarWidth: (width) => set({ navbarWidth: width }),
      millerVisibleColumns: 2,
      setMillerVisibleColumns: (count) => set({ millerVisibleColumns: count }),
      navbarOpenSections: ['group:concepts', 'group:dashboards'],
      setNavbarOpenSections: (keys) => set({ navbarOpenSections: keys }),
      themeMode:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () =>
        set({ themeMode: get().themeMode === 'light' ? 'dark' : 'light' }),
      density: 'comfortable',
      setDensity: (density) => set({ density }),
      toggleDensity: () =>
        set({ density: get().density === 'compact' ? 'comfortable' : 'compact' }),
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

/** One prompt → response exchange of a view assistant conversation. */
export interface AssistantTurn {
  id: string;
  prompt: string;
  at: number;
  /** Version number of the spec this turn refined from (0 = the saved view). */
  basedOn: number | null;
  spec?: ViewSpec;
  model?: string;
  reasoning?: string[];
  error?: string;
}

interface AssistantChatsState {
  /** Conversations keyed by `concept|scope|viewId`. */
  sessions: Record<string, { turns: AssistantTurn[]; updatedAt: number }>;
  addTurn: (key: string, turn: AssistantTurn) => void;
  clear: (key: string) => void;
}

const MAX_ASSISTANT_SESSIONS = 30;

// The assistant's chat history survives closing the modal so a refinement
// session can be resumed where it was left.
export const useAssistantChats = create<AssistantChatsState>()(
  persist(
    (set, get) => ({
      sessions: {},
      addTurn: (key, turn) => {
        const sessions = { ...get().sessions };
        sessions[key] = { turns: [...(sessions[key]?.turns ?? []), turn], updatedAt: Date.now() };
        const keys = Object.keys(sessions).sort((a, b) => sessions[b].updatedAt - sessions[a].updatedAt);
        for (const k of keys.slice(MAX_ASSISTANT_SESSIONS)) delete sessions[k];
        set({ sessions });
      },
      clear: (key) => {
        const { [key]: _removed, ...rest } = get().sessions;
        set({ sessions: rest });
      },
    }),
    { name: 'fluid-assistant-chats' },
  ),
);
