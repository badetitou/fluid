import type { ComponentType } from 'react';
import { describeIssues } from '@fluid/shared';
import type { DataSource, WidgetProps } from '../../views/plugin-api';
import { fetchJson } from './fetchJson';
import { pluginManifestSchema, type PluginManifest } from './manifest';
import type { ModuleProvided } from './model';
import { modulePageAction, type PageAction } from './pageAction';
import { checkedSourceProvider, type SourceProvider, type SourceProviderEntry } from './sourceProvider';
import type { ViewBuilder } from './viewBuilder';

/**
 * Where a manifest may be read from: HTTPS, fluid's own origin, or HTTP
 * loopback servers when fluid itself runs on loopback.
 */
export function resolveManifestUrl(input: string, origin: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim(), origin);
  } catch {
    throw new Error('This is not a valid URL.');
  }
  const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
  const localDevelopment = url.protocol === 'http:' && loopback.has(url.hostname)
    && loopback.has(new URL(origin).hostname);
  if (url.protocol !== 'https:' && url.origin !== origin && !localDevelopment) {
    throw new Error('Plugins are installed from https:// URLs (or from fluid’s own site).');
  }
  return url;
}

/** Fetches and validates a plugin manifest. */
export async function fetchManifest(url: URL): Promise<PluginManifest> {
  const json = await fetchJson(url, 'manifest');
  const parsed = pluginManifestSchema.safeParse(json);
  if (!parsed.success) throw new Error(`Invalid manifest:\n${describeIssues(parsed.error)}`);
  return parsed.data;
}

type ModuleEntries = Record<string, Record<string, unknown> | undefined>;

/** The renderers the module provides for the widgets its manifest declares. */
function moduleRenderers(manifest: PluginManifest, widgets: ModuleEntries | undefined): ModuleProvided['renderers'] {
  return (manifest.contributes.widgets ?? []).map(({ type }) => {
    const entry = widgets?.[type];
    if (typeof entry?.Render !== 'function') throw new Error(`The plugin module does not render “${type}”.`);
    return {
      type,
      Render: entry.Render as ComponentType<WidgetProps>,
      sizing: entry.sizing === 'chart' ? 'chart' : 'flow',
    };
  });
}

/** The view builders the module provides for those its manifest declares. */
function moduleBuilders(manifest: PluginManifest, builders: ModuleEntries | undefined): ViewBuilder[] {
  return (manifest.contributes.viewBuilders ?? []).map(({ id, label }) => {
    const entry = builders?.[id];
    const { perspectives, fetchPerspectives, dataSource, ColumnOverlay } = entry ?? {};
    if (typeof perspectives !== 'function' && typeof fetchPerspectives !== 'function')
      throw new Error(`The plugin module does not build “${id}” views.`);
    return {
      id,
      label,
      perspectives: typeof perspectives === 'function' ? (perspectives as ViewBuilder['perspectives']) : undefined,
      fetchPerspectives:
        typeof fetchPerspectives === 'function' ? (fetchPerspectives as ViewBuilder['fetchPerspectives']) : undefined,
      dataSource: typeof dataSource === 'function' ? (dataSource as (s: Record<string, string>) => DataSource) : undefined,
      ColumnOverlay: typeof ColumnOverlay === 'function' ? (ColumnOverlay as ViewBuilder['ColumnOverlay']) : undefined,
    };
  });
}

/** The source providers the module lists; those with sources in the manifest may be left out. */
function moduleProviders(manifest: PluginManifest, providers: ModuleEntries | undefined): SourceProvider[] {
  return (manifest.contributes.sourceProviders ?? []).flatMap((contract) => {
    const entry = providers?.[contract.id];
    const listSources = entry?.listSources;
    if (typeof listSources === 'function')
      return [checkedSourceProvider(contract, { ...entry, listSources } as SourceProviderEntry)];
    if (contract.sources) return [];
    throw new Error(`The plugin module does not list the sources of “${contract.id}”.`);
  });
}

/** The page actions the module runs or draws, for those its manifest declares. */
function moduleActions(manifest: PluginManifest, actions: ModuleEntries | undefined): PageAction[] {
  return (manifest.contributes.pageActions ?? []).map((contract) => modulePageAction(contract, actions?.[contract.id]));
}

/**
 * Imports a plugin's module and returns what it provides for its manifest's
 * contributions. The module's default export receives the plugin host and
 * returns `{ widgets: { "<type>": { Render, sizing? } } }` (widget plugin) or
 * `{ viewBuilders: { "<id>": { perspectives | fetchPerspectives, dataSource?, ColumnOverlay? } } }` (view builder plugin)
 * or `{ sourceProviders: { "<id>": { listSources(settings, signal) } } }` (source provider plugin)
 * or `{ pageActions: { "<id>": { run | Panel, available? } } }` (page action plugin).
 */
export async function loadPluginModule(manifestUrl: string, manifest: PluginManifest): Promise<ModuleProvided> {
  if (!manifest.module) return {};
  const href = new URL(manifest.module, manifestUrl).href;
  const [mod, { createPluginHost }] = await Promise.all([
    import(/* @vite-ignore */ href),
    import('./host'),
  ]);
  if (typeof mod.default !== 'function')
    throw new Error('The plugin module has no default export function.');
  const provided = (await mod.default(createPluginHost())) as
    | { widgets?: ModuleEntries; viewBuilders?: ModuleEntries; sourceProviders?: ModuleEntries; pageActions?: ModuleEntries }
    | undefined;
  return {
    renderers: moduleRenderers(manifest, provided?.widgets),
    builders: moduleBuilders(manifest, provided?.viewBuilders),
    providers: moduleProviders(manifest, provided?.sourceProviders),
    actions: moduleActions(manifest, provided?.pageActions),
  };
}
