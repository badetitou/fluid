export { BUILTIN_PLUGINS, DEFAULT_THEME_ID } from './builtin';
export { contributionKinds, pluginManifestSchema, type PluginManifest } from './manifest';
export { activeWidgetCatalog, availableThemes, pickTheme } from './model';
export { PluginsContext } from './PluginsContext';
export { usePluginRuntime } from './usePluginRuntime';
export {
  currentCatalogRequest,
  currentWidgetContracts,
  usePluginActions,
  usePlugins,
  useThemeChoice,
} from './usePlugins';
export type { FluidPlugin, InstalledPlugin, PluginLoadState, PluginSource } from './types';
