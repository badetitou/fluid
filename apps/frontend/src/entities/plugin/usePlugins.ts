import { useCallback, useContext, useMemo } from 'react';
import { builderColors } from './builderColors';
import { BUILTIN_PLUGINS, DEFAULT_THEME_ID } from './builtin';
import { fetchManifest, resolveManifestUrl } from './loader';
import {
  activeContracts,
  activeColumnOverlays,
  activeDataSources,
  activeViewBuilders,
  availableThemes,
  catalogRequest,
  conflictingId,
  installedPlugin,
  isEnabled,
  pickTheme,
  settingsOf,
} from './model';
import { PluginsContext } from './PluginsContext';
import { usePluginStore } from './store';
import type { FluidPlugin, InstalledPlugin } from './types';

/** Every plugin with whether it is enabled. */
export function usePlugins() {
  const plugins = useContext(PluginsContext);
  const disabled = usePluginStore((s) => s.disabled);
  return useMemo(
    () => plugins.map((plugin) => ({ plugin, enabled: isEnabled(plugin, disabled) })),
    [plugins, disabled],
  );
}

/** Enabling, disabling, installing and removing plugins. */
export function usePluginActions() {
  const plugins = useContext(PluginsContext);
  const setEnabled = usePluginStore((s) => s.setEnabled);
  const uninstall = usePluginStore((s) => s.uninstall);
  const install = usePluginStore((s) => s.install);

  /** Reads and validates the manifest at `input`; nothing is installed until `install` is called with it. */
  const inspect = useCallback(
    async (input: string): Promise<InstalledPlugin> => {
      const url = resolveManifestUrl(input, window.location.origin);
      const manifest = await fetchManifest(url);
      if (conflictingId(plugins, manifest.id, url.href)) {
        throw new Error(`A plugin with the id “${manifest.id}” is already installed.`);
      }
      return { url: url.href, manifest };
    },
    [plugins],
  );

  return { setEnabled, uninstall, inspect, install };
}

/** The view builders of the enabled plugins, with their settings and colours, in plugin order. */
export function useActiveViewBuilders() {
  const plugins = useContext(PluginsContext);
  const disabled = usePluginStore((s) => s.disabled);
  const settings = usePluginStore((s) => s.settings);
  const chosen = usePluginStore((s) => s.builderColors);
  return useMemo(
    () => activeViewBuilders(plugins, disabled, settings, chosen),
    [plugins, disabled, settings, chosen],
  );
}

/** The colour of every view builder, by id, whether the user chose it, and the setter. */
export function useBuilderColors() {
  const plugins = useContext(PluginsContext);
  const chosen = usePluginStore((s) => s.builderColors);
  const setColor = usePluginStore((s) => s.setBuilderColor);
  const colors = useMemo(() => builderColors(plugins, chosen), [plugins, chosen]);
  return { colors, chosen, setColor };
}

/** The data sources the enabled view builders bring, by id. */
export function useActiveDataSources() {
  const builders = useActiveViewBuilders();
  return useMemo(() => activeDataSources(builders), [builders]);
}

/** A plugin's settings (filled or default) and the setter. */
export function usePluginSettings(plugin: FluidPlugin) {
  const filled = usePluginStore((s) => s.settings);
  const setSetting = usePluginStore((s) => s.setSetting);
  const values = useMemo(() => settingsOf(plugin, filled), [plugin, filled]);
  const set = useCallback(
    (key: string, value: string) => setSetting(plugin.manifest.id, key, value),
    [plugin.manifest.id, setSetting],
  );
  return { values, set };
}

/** The themes of the enabled plugins and the chosen one. */
export function useThemeChoice() {
  const plugins = useContext(PluginsContext);
  const disabled = usePluginStore((s) => s.disabled);
  const themeId = usePluginStore((s) => s.themeId);
  const setTheme = usePluginStore((s) => s.setTheme);
  const themes = useMemo(() => availableThemes(plugins, disabled), [plugins, disabled]);
  const active = useMemo(() => pickTheme(themes, themeId, DEFAULT_THEME_ID), [themes, themeId]);
  return { themes, active, setTheme };
}

// Read when an LLM request starts, like the LLM settings, so the callbacks
// that send requests stay stable. Installed plugins are taken from their
// manifest: their contracts do not need the module.
function currentPlugins(): { plugins: FluidPlugin[]; disabled: string[] } {
  const { installed, disabled } = usePluginStore.getState();
  return {
    plugins: [...BUILTIN_PLUGINS, ...installed.map((p) => installedPlugin(p, { status: 'ready' }))],
    disabled,
  };
}

/** The widget catalog to send with an LLM request. */
export function currentCatalogRequest() {
  const { plugins, disabled } = currentPlugins();
  return catalogRequest(plugins, disabled);
}

/** The contracts of the enabled widgets, to check a generated widget. */
export function currentWidgetContracts() {
  const { plugins, disabled } = currentPlugins();
  return activeContracts(plugins, disabled);
}

/** The column overlays of the enabled view builders, in plugin order. */
export function useActiveColumnOverlays() {
  const builders = useActiveViewBuilders();
  return useMemo(() => activeColumnOverlays(builders), [builders]);
}
