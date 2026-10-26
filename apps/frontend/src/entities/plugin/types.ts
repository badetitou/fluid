import type { WidgetContract } from '@fluid/shared';
import type { ThemeDefinition } from '../../shared/theme';
import type { WidgetRendererDefinition } from '../../views/plugin-api';
import type { PluginKind, PluginManifest } from './manifest';
import type { PageAction } from './pageAction';
import type { SourceProvider } from './sourceProvider';
import type { ViewBuilder } from './viewBuilder';

/** Where a plugin comes from: shipped with fluid, or installed from a manifest URL. */
export type PluginSource = { kind: 'builtin' } | { kind: 'url'; url: string };

/** State of a plugin's module (plugins without one are always `ready`). */
export type PluginLoadState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

interface PluginBase {
  manifest: PluginManifest;
  source: PluginSource;
  /** The app needs it: it cannot be disabled. */
  required?: boolean;
  load: PluginLoadState;
}

/** A theme plugin: colour tokens, fonts, per-widget overrides. Plain data. */
export interface ThemePlugin extends PluginBase {
  kind: 'theme';
  themes: ThemeDefinition[];
}

/** A widget plugin: widget types (contract + renderer). Renders the data it is given, never fetches. */
export interface WidgetPlugin extends PluginBase {
  kind: 'widget';
  contracts: WidgetContract[];
  renderers: WidgetRendererDefinition[];
}

/** A view builder plugin: proposes perspectives for a column, and may bring the data source they read. */
export interface ViewBuilderPlugin extends PluginBase {
  kind: 'viewBuilder';
  builders: ViewBuilder[];
}

/** A source provider plugin: GraphQL sources (name + URL) offered in the source switcher. */
export interface SourceProviderPlugin extends PluginBase {
  kind: 'sourceProvider';
  providers: SourceProvider[];
}

/** A page action plugin: actions on the whole page, offered by a floating button on every page. */
export interface PageActionPlugin extends PluginBase {
  kind: 'pageAction';
  actions: PageAction[];
}

/** A plugin as the app uses it: its manifest and what it provides once loaded. */
export type FluidPlugin = ThemePlugin | WidgetPlugin | ViewBuilderPlugin | SourceProviderPlugin | PageActionPlugin;

export type { PluginKind };

/** An installed plugin, as persisted: its URL and the manifest read at install time. */
export interface InstalledPlugin {
  url: string;
  manifest: PluginManifest;
}
