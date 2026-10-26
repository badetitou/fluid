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
  /** What the user filled in the plugins' settings, by plugin id then setting key. */
  settings: Record<string, Record<string, string>>;
  /** The colours the user gave view builders, by builder id. */
  builderColors: Record<string, string>;
  setEnabled: (id: string, enabled: boolean) => void;
  install: (plugin: InstalledPlugin) => void;
  uninstall: (id: string) => void;
  setTheme: (id: string) => void;
  setSetting: (pluginId: string, key: string, value: string) => void;
  /** No colour: back to the builder's own. */
  setBuilderColor: (builderId: string, color?: string) => void;
}

// Plugins are a per-browser choice, like the other interface preferences. Only
// read and written through the hooks of this slice.
export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      disabled: [],
      installed: [],
      themeId: DEFAULT_THEME_ID,
      settings: {},
      builderColors: {},
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
      setSetting: (pluginId, key, value) => {
        const { settings } = get();
        set({ settings: { ...settings, [pluginId]: { ...settings[pluginId], [key]: value } } });
      },
      setBuilderColor: (builderId, color) => {
        const { [builderId]: _previous, ...others } = get().builderColors;
        set({ builderColors: color ? { ...others, [builderId]: color } : others });
      },
    }),
    { name: 'fluid-plugins' },
  ),
);
