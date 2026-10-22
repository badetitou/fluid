import type { ComponentType } from 'react';
import { describeIssues } from '@fluid/shared';
import type { WidgetProps, WidgetRendererDefinition } from '../../views/plugin-api';
import { pluginManifestSchema, type PluginManifest } from './manifest';

/**
 * Where a manifest may be read from: any `https:` URL, or fluid's own origin
 * (relative URLs included, e.g. the examples under `/plugins/`).
 */
export function resolveManifestUrl(input: string, origin: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim(), origin);
  } catch {
    throw new Error('This is not a valid URL.');
  }
  if (url.protocol !== 'https:' && url.origin !== origin) {
    throw new Error('Plugins are installed from https:// URLs (or from fluid’s own site).');
  }
  return url;
}

/** Fetches and validates a plugin manifest. */
export async function fetchManifest(url: URL): Promise<PluginManifest> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`The manifest could not be fetched (HTTP ${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('The manifest is not valid JSON.');
  }
  const parsed = pluginManifestSchema.safeParse(json);
  if (!parsed.success) throw new Error(`Invalid manifest:\n${describeIssues(parsed.error)}`);
  return parsed.data;
}

type ModuleWidgets = Record<string, { Render?: unknown; sizing?: unknown } | undefined>;

/**
 * Imports a plugin's module and returns a renderer for each widget its
 * manifest declares. The module's default export receives the plugin host
 * and returns `{ widgets: { "<type>": { Render, sizing? } } }`.
 */
export async function loadPluginModule(
  manifestUrl: string,
  manifest: PluginManifest,
): Promise<WidgetRendererDefinition[]> {
  if (!manifest.module) return [];
  const href = new URL(manifest.module, manifestUrl).href;
  const [mod, { createPluginHost }] = await Promise.all([
    import(/* @vite-ignore */ href),
    import('./host'),
  ]);
  if (typeof mod.default !== 'function')
    throw new Error('The plugin module has no default export function.');
  const provided = (await mod.default(createPluginHost())) as
    { widgets?: ModuleWidgets } | undefined;
  return (manifest.contributes.widgets ?? []).map(({ type }) => {
    const entry = provided?.widgets?.[type];
    if (typeof entry?.Render !== 'function')
      throw new Error(`The plugin module does not render “${type}”.`);
    return {
      type,
      Render: entry.Render as ComponentType<WidgetProps>,
      sizing: entry.sizing === 'chart' ? 'chart' : 'flow',
    };
  });
}
