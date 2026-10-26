export { BUILTIN_PLUGINS, DEFAULT_THEME_ID } from './builtin';
export {
  contributionLabel,
  PLUGIN_KINDS,
  pluginKind,
  pluginManifestSchema,
  type PluginKind,
  type PluginManifest,
  type PluginSetting,
  type SourceEntry,
} from './manifest';
export { DEMO_SOURCES, type DemoSource } from './sources/demoSources';
export { usePluginSources, type SourceGroup } from './usePluginSources';
export { activeWidgetCatalog, availableThemes, contractsOf, pickTheme, themesOf, type ActiveViewBuilder } from './model';
export { PluginsContext } from './PluginsContext';
export { usePluginRuntime } from './usePluginRuntime';
export {
  currentCatalogRequest,
  currentWidgetContracts,
  useActiveDataSources,
  useActiveViewBuilders,
  useBuilderColors,
  usePluginActions,
  usePluginSettings,
  usePlugins,
  useThemeChoice,
} from './usePlugins';
export type {
  FluidPlugin,
  InstalledPlugin,
  PluginLoadState,
  PluginSource,
  SourceProviderPlugin,
  ThemePlugin,
  ViewBuilderPlugin,
  WidgetPlugin,
} from './types';
export type { SourceProvider } from './sourceProvider';
export type { BuiltPerspective, Perspective, PerspectiveOrigin, ViewBuilder, ViewBuilderContext } from './viewBuilder';
