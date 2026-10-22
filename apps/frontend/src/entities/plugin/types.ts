import type { WidgetContract } from '@fluid/shared';
import type { ThemeDefinition } from '../../shared/theme';
import type { WidgetRendererDefinition } from '../../views/plugin-api';
import type { PluginManifest } from './manifest';

/** Where a plugin comes from: shipped with fluid, or installed from a manifest URL. */
export type PluginSource = { kind: 'builtin' } | { kind: 'url'; url: string };

/** State of a plugin's module (plugins without one are always `ready`). */
export type PluginLoadState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/** A plugin as the app uses it: its manifest and what it provides once loaded. */
export interface FluidPlugin {
  manifest: PluginManifest;
  source: PluginSource;
  /** The app needs it: it cannot be disabled. */
  required?: boolean;
  contracts: WidgetContract[];
  renderers: WidgetRendererDefinition[];
  themes: ThemeDefinition[];
  load: PluginLoadState;
}

/** An installed plugin, as persisted: its URL and the manifest read at install time. */
export interface InstalledPlugin {
  url: string;
  manifest: PluginManifest;
}
