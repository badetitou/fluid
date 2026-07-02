import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      navbarSide: 'left',
      setNavbarSide: (side) => set({ navbarSide: side }),
      toggleNavbarSide: () =>
        set({ navbarSide: get().navbarSide === 'left' ? 'right' : 'left' }),
    }),
    { name: 'fluid-preferences' },
  ),
);
