import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_THEME_ID } from './builtin';
import type { InstalledPlugin } from './types';

interface PluginState {
  /** Ids of the plugins the user turned off (built-in or installed). */
  disabled: string[];
  /** Plugins installed from a manifest URL. */
  installed: InstalledPlugin[];
  /** The chosen theme (see `pickTheme` for the fallback). */
  themeId: string;
  setEnabled: (id: string, enabled: boolean) => void;
  install: (plugin: InstalledPlugin) => void;
  uninstall: (id: string) => void;
  setTheme: (id: string) => void;
}

// Plugins are a per-browser choice, like the other interface preferences. Only
// read and written through the hooks of this slice.
export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      disabled: [],
      installed: [],
      themeId: DEFAULT_THEME_ID,
      setEnabled: (id, enabled) => {
        const rest = get().disabled.filter((d) => d !== id);
        set({ disabled: enabled ? rest : [...rest, id] });
      },
      install: (plugin) => {
        const others = get().installed.filter((p) => p.manifest.id !== plugin.manifest.id);
        set({
          installed: [...others, plugin],
          disabled: get().disabled.filter((d) => d !== plugin.manifest.id),
        });
      },
      uninstall: (id) => set({ installed: get().installed.filter((p) => p.manifest.id !== id) }),
      setTheme: (id) => set({ themeId: id }),
    }),
    { name: 'fluid-plugins' },
  ),
);
