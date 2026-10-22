import {
  isPluginWidgetType,
  pluginOfWidgetType,
  type ExternalWidgetContract,
  type WidgetCatalogRequest,
  type WidgetContract,
} from '@fluid/shared';
import type { ThemeDefinition } from '../../shared/theme';
import type { WidgetCatalog, WidgetRendererDefinition } from '../../views/plugin-api';
import type { FluidPlugin, InstalledPlugin, PluginLoadState } from './types';

/** Whether a plugin is in use: required ones always are. */
export const isEnabled = (plugin: FluidPlugin, disabled: readonly string[]): boolean =>
  plugin.required === true || !disabled.includes(plugin.manifest.id);

/** An installed plugin with what its module provided (renderers by type), or why it did not. */
export function installedPlugin(
  installed: InstalledPlugin,
  load: PluginLoadState,
  renderers: WidgetRendererDefinition[] = [],
): FluidPlugin {
  const { manifest } = installed;
  return {
    manifest,
    source: { kind: 'url', url: installed.url },
    contracts: manifest.contributes.widgets ?? [],
    renderers,
    themes: manifest.contributes.themes ?? [],
    load: manifest.module ? load : { status: 'ready' },
  };
}

/** The renderers of the enabled plugins, and why the others' widgets are missing. */
export function activeWidgetCatalog(
  plugins: FluidPlugin[],
  disabled: readonly string[],
): WidgetCatalog {
  const renderers = new Map<string, WidgetRendererDefinition>();
  for (const plugin of plugins) {
    if (!isEnabled(plugin, disabled)) continue;
    for (const r of plugin.renderers) renderers.set(r.type, r);
  }
  const owner = (type: string) =>
    plugins.find((p) => p.contracts.some((c) => c.type === type)) ??
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
  return plugins.filter((p) => isEnabled(p, disabled)).flatMap((p) => p.contracts);
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
  return plugins.filter((p) => isEnabled(p, disabled)).flatMap((p) => p.themes);
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
