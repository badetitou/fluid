import {
  isPluginWidgetType,
  pluginOfWidgetType,
  type ExternalWidgetContract,
  type WidgetCatalogRequest,
  type WidgetContract,
} from '@fluid/shared';
import type { ThemeDefinition } from '../../shared/theme';
import type { WidgetCatalog, WidgetRendererDefinition } from '../../views/plugin-api';
import type { DataSource } from '../../views/plugin-api';
import { builderColors } from './builderColors';
import { pluginKind, type PluginSetting } from './manifest';
import { staticSourceProvider, type SourceProvider } from './sourceProvider';
import type { FluidPlugin, InstalledPlugin, PluginLoadState } from './types';
import type { ViewBuilder } from './viewBuilder';

/** The widget contracts a plugin provides (none unless it is a widget plugin). */
export const contractsOf = (p: FluidPlugin): WidgetContract[] => (p.kind === 'widget' ? p.contracts : []);
/** The widget renderers a plugin provides. */
export const renderersOf = (p: FluidPlugin): WidgetRendererDefinition[] => (p.kind === 'widget' ? p.renderers : []);
/** The themes a plugin provides. */
export const themesOf = (p: FluidPlugin): ThemeDefinition[] => (p.kind === 'theme' ? p.themes : []);
/** The view builders a plugin provides. */
export const buildersOf = (p: FluidPlugin): ViewBuilder[] => (p.kind === 'viewBuilder' ? p.builders : []);
/** The source providers a plugin provides. */
export const providersOf = (p: FluidPlugin): SourceProvider[] => (p.kind === 'sourceProvider' ? p.providers : []);

/** Whether a plugin is in use: required ones always are. */
export const isEnabled = (plugin: FluidPlugin, disabled: readonly string[]): boolean =>
  plugin.required === true || !disabled.includes(plugin.manifest.id);

/** What a plugin module provides once imported. */
export interface ModuleProvided {
  renderers?: WidgetRendererDefinition[];
  builders?: ViewBuilder[];
  providers?: SourceProvider[];
}

/** An installed plugin with what its module provided, or why it did not. */
export function installedPlugin(
  installed: InstalledPlugin,
  load: PluginLoadState,
  provided: ModuleProvided = {},
): FluidPlugin {
  const { manifest } = installed;
  const base = {
    manifest,
    source: { kind: 'url', url: installed.url } as const,
    load: manifest.module ? load : ({ status: 'ready' } as const),
  };
  switch (pluginKind(manifest)) {
    case 'theme':
      return { ...base, kind: 'theme', themes: manifest.contributes.themes ?? [] };
    case 'widget':
      return { ...base, kind: 'widget', contracts: manifest.contributes.widgets ?? [], renderers: provided.renderers ?? [] };
    case 'viewBuilder':
      return { ...base, kind: 'viewBuilder', builders: provided.builders ?? [] };
    case 'sourceProvider': {
      // Providers that list their sources work without the module.
      const fromModule = new Map((provided.providers ?? []).map((p) => [p.id, p]));
      const providers = (manifest.contributes.sourceProviders ?? []).flatMap((c) => {
        const provider = fromModule.get(c.id) ?? (c.sources ? staticSourceProvider(c) : undefined);
        return provider ? [provider] : [];
      });
      return { ...base, kind: 'sourceProvider', providers };
    }
  }
}

/** The renderers of the enabled plugins, and why the others' widgets are missing. */
export function activeWidgetCatalog(
  plugins: FluidPlugin[],
  disabled: readonly string[],
): WidgetCatalog {
  const renderers = new Map<string, WidgetRendererDefinition>();
  for (const plugin of plugins) {
    if (!isEnabled(plugin, disabled)) continue;
    for (const r of renderersOf(plugin)) renderers.set(r.type, r);
  }
  const owner = (type: string) =>
    plugins.find((p) => contractsOf(p).some((c) => c.type === type)) ??
    plugins.find((p) => p.manifest.id === pluginOfWidgetType(type));
  return {
    renderers,
    explainMissing: (type) => {
      const plugin = owner(type);
      if (!plugin) {
        const id = pluginOfWidgetType(type);
        return id
          ? `It comes from the plugin “${id}”, which is not installed. Install it from Settings → Plugins.`
          : `No installed plugin provides the “${type}” widget.`;
      }
      const name = plugin.manifest.name;
      if (!isEnabled(plugin, disabled))
        return `It comes from the plugin “${name}”, which is disabled in Settings → Plugins.`;
      if (plugin.load.status === 'error')
        return `The plugin “${name}” failed to load: ${plugin.load.message}`;
      if (plugin.load.status === 'loading') return `The plugin “${name}” is loading…`;
      return `The plugin “${name}” does not render the “${type}” widget.`;
    },
  };
}

/** The contracts of the widgets the enabled plugins provide (what the LLM may use). */
export function activeContracts(
  plugins: FluidPlugin[],
  disabled: readonly string[],
): WidgetContract[] {
  return plugins.filter((p) => isEnabled(p, disabled)).flatMap(contractsOf);
}

/** The catalog sent with LLM requests: enabled built-in types, and the plugins' own contracts. */
export function catalogRequest(
  plugins: FluidPlugin[],
  disabled: readonly string[],
): WidgetCatalogRequest {
  const contracts = activeContracts(plugins, disabled);
  return {
    types: contracts.filter((c) => !isPluginWidgetType(c.type)).map((c) => c.type),
    external: contracts.filter(
      (c): c is ExternalWidgetContract => isPluginWidgetType(c.type) && !!c.jsonSchema,
    ),
  };
}

/** The themes of the enabled plugins. */
export function availableThemes(
  plugins: FluidPlugin[],
  disabled: readonly string[],
): ThemeDefinition[] {
  return plugins.filter((p) => isEnabled(p, disabled)).flatMap(themesOf);
}

/** The chosen theme when available, else the default one, else the first. */
export function pickTheme(
  themes: ThemeDefinition[],
  id: string,
  fallbackId: string,
): ThemeDefinition {
  return themes.find((t) => t.id === id) ?? themes.find((t) => t.id === fallbackId) ?? themes[0];
}

/** Ids already taken, so an install cannot shadow another plugin. */
export function conflictingId(plugins: FluidPlugin[], id: string, url: string): boolean {
  return plugins.some(
    (p) => p.manifest.id === id && !(p.source.kind === 'url' && p.source.url === url),
  );
}

/** A plugin's settings: what the user filled, else each setting's default. */
export function settingsOf(
  plugin: FluidPlugin,
  filled: Readonly<Record<string, Record<string, string>>>,
): Record<string, string> {
  const declared: PluginSetting[] = plugin.manifest.settings ?? [];
  const mine = filled[plugin.manifest.id] ?? {};
  return Object.fromEntries(declared.map((s) => [s.key, mine[s.key]?.trim() || s.default || '']));
}

/** A view builder of an enabled plugin, with that plugin's settings and its colour. */
export interface ActiveViewBuilder {
  builder: ViewBuilder;
  settings: Record<string, string>;
  color: string;
}

/** The view builders of the enabled plugins, in plugin order, with their settings and colours. */
export function activeViewBuilders(
  plugins: FluidPlugin[],
  disabled: readonly string[],
  filled: Readonly<Record<string, Record<string, string>>>,
  chosenColors: Readonly<Record<string, string>> = {},
): ActiveViewBuilder[] {
  const colors = builderColors(plugins, chosenColors);
  return plugins
    .filter((p) => isEnabled(p, disabled))
    .flatMap((p) =>
      buildersOf(p).map((builder) => ({
        builder,
        settings: settingsOf(p, filled),
        color: colors.get(builder.id) ?? 'currentColor',
      })),
    );
}

/** The data sources the active view builders bring, by builder id. */
export function activeDataSources(builders: ActiveViewBuilder[]): Map<string, DataSource> {
  const sources = new Map<string, DataSource>();
  for (const { builder, settings } of builders) {
    const source = builder.dataSource?.(settings);
    if (source) sources.set(source.id, source);
  }
  return sources;
}

/** A source provider of an enabled plugin, with that plugin's settings. */
export interface ActiveSourceProvider {
  provider: SourceProvider;
  settings: Record<string, string>;
}

/** The source providers of the enabled plugins, in plugin order, with their settings. */
export function activeSourceProviders(
  plugins: FluidPlugin[],
  disabled: readonly string[],
  filled: Readonly<Record<string, Record<string, string>>>,
): ActiveSourceProvider[] {
  return plugins
    .filter((p) => isEnabled(p, disabled))
    .flatMap((p) => providersOf(p).map((provider) => ({ provider, settings: settingsOf(p, filled) })));
}

/** A column overlay of an enabled view builder, with that builder's settings. */
export interface ActiveColumnOverlay {
  id: string;
  Overlay: NonNullable<ViewBuilder['ColumnOverlay']>;
  settings: Record<string, string>;
}

/** The column overlays the enabled view builders bring, in plugin order. */
export function activeColumnOverlays(builders: ActiveViewBuilder[]): ActiveColumnOverlay[] {
  return builders.flatMap(({ builder, settings }) =>
    builder.ColumnOverlay ? [{ id: builder.id, Overlay: builder.ColumnOverlay, settings }] : [],
  );
}
