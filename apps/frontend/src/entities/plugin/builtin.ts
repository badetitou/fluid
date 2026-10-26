import { BUILTIN_WIDGET_COLLECTIONS, BUILTIN_WIDGET_CONTRACTS } from '@fluid/shared';
import { BADETITOU_THEME, type ThemeDefinition } from '../../shared/theme';
import { builtinRenderer } from '../../views/widgets/catalog';
import { autoViewBuilder } from './builders/autoViews';
import { curatedViewBuilder } from './builders/curatedViews';
import { fireworksAction } from './actions/fireworks';
import { ENDPOINT_SETTING, pharoScriptAction, specFluidViewBuilder } from './builders/specFluid';
import { HIGH_CONTRAST_THEME, SOLARIZED_THEME } from './builtinThemes';
import { CATPPUCCIN_THEMES } from './catppuccin';
import type { PluginManifest } from './manifest';
import type { PageAction } from './pageAction';
import { staticSourceProvider } from './sourceProvider';
import { DEMO_SOURCES } from './sources/demoSources';
import type { FluidPlugin, PageActionPlugin, SourceProviderPlugin, ThemePlugin, ViewBuilderPlugin, WidgetPlugin } from './types';
import type { ViewBuilder } from './viewBuilder';

const VERSION = '1.0.0';
const BUILTIN = { source: { kind: 'builtin' }, load: { status: 'ready' } } as const;

/** The built-in widget collections, as widget plugins. */
const widgetPlugins: WidgetPlugin[] = BUILTIN_WIDGET_COLLECTIONS.map((collection) => ({
  ...BUILTIN,
  kind: 'widget',
  manifest: {
    id: collection.id,
    name: collection.name,
    version: VERSION,
    kind: 'widget',
    description: collection.description,
    author: 'fluid',
    contributes: { widgets: [] },
  },
  required: collection.required,
  contracts: collection.types.map((type) => BUILTIN_WIDGET_CONTRACTS[type]),
  renderers: collection.types.map(builtinRenderer),
}));

type ThemeManifest = Pick<PluginManifest, 'id' | 'name' | 'description'>;

const themesPlugin = (manifest: ThemeManifest, themes: ThemeDefinition[], required = false): ThemePlugin => ({
  ...BUILTIN,
  kind: 'theme',
  manifest: { ...manifest, version: VERSION, kind: 'theme', author: 'fluid', contributes: { themes } },
  required,
  themes,
});

const themePlugin = (theme: ThemeDefinition, required = false): ThemePlugin =>
  themesPlugin(
    { id: `fluid-theme-${theme.id}`, name: `${theme.label} theme`, description: theme.description },
    [theme],
    required,
  );

type BuilderManifest = Pick<PluginManifest, 'id' | 'name' | 'description' | 'settings'>;

const viewBuilderPlugin = (manifest: BuilderManifest, builder: ViewBuilder, color: string): ViewBuilderPlugin => ({
  ...BUILTIN,
  kind: 'viewBuilder',
  manifest: {
    ...manifest,
    version: VERSION,
    kind: 'viewBuilder',
    author: 'fluid',
    contributes: { viewBuilders: [{ id: builder.id, label: builder.label, color }] },
  },
  builders: [builder],
});

/** The built-in view builders, in the order their perspectives are listed (after the saved ones). */
const specFluidEndpoint = (description: string) => ({
  key: ENDPOINT_SETTING,
  label: 'Spec-Fluid endpoint',
  description,
  placeholder: 'http://localhost:8081/spec-fluid',
});

const viewBuilderPlugins: ViewBuilderPlugin[] = [
  viewBuilderPlugin(
    { id: 'fluid-curated-views', name: 'Curated views', description: 'Example perspectives shipped with fluid for well-known concepts.' },
    curatedViewBuilder,
    '#eb2f96',
  ),
  viewBuilderPlugin(
    {
      id: 'fluid-auto-views',
      name: 'Automatic views',
      description: 'An overview of every concept, a detail of every item and a tree of hierarchies, built from the GraphQL schema.',
    },
    autoViewBuilder,
    '#1677ff',
  ),
  viewBuilderPlugin(
    {
      id: 'spec-fluid',
      name: 'Spec-Fluid (Pharo inspectors)',
      description:
        'The inspector tabs Pharo defines for a Moose entity (Navigation, Fame, Blueprint, UML…), served by the Spec-Fluid project of the image, as perspectives of its detail column.',
      settings: [specFluidEndpoint('Where the image serves Spec-Fluid (SFServer start). Leave empty to turn it off.')],
    },
    specFluidViewBuilder,
    '#722ed1',
  ),
];

const demoSourcesContract = {
  id: 'demo-apis',
  label: 'Demo APIs',
  sources: DEMO_SOURCES.map(({ label, url, description }) => ({ name: label, url, description })),
};

/** The public demo APIs, offered in the source switcher. */
const demoSourcesPlugin: SourceProviderPlugin = {
  ...BUILTIN,
  kind: 'sourceProvider',
  manifest: {
    id: 'fluid-demo-sources',
    name: 'Demo sources',
    version: VERSION,
    kind: 'sourceProvider',
    description: 'Public, CORS-enabled GraphQL APIs to try fluid without running anything.',
    author: 'fluid',
    contributes: { sourceProviders: [demoSourcesContract] },
  },
  providers: [staticSourceProvider(demoSourcesContract)],
};

type ActionManifest = Pick<PluginManifest, 'id' | 'name' | 'description' | 'settings'>;

const pageActionPlugin = (manifest: ActionManifest, actions: PageAction[]): PageActionPlugin => ({
  ...BUILTIN,
  kind: 'pageAction',
  manifest: {
    ...manifest,
    version: VERSION,
    kind: 'pageAction',
    author: 'fluid',
    contributes: { pageActions: actions.map(({ id, label, description, icon }) => ({ id, label, description, icon })) },
  },
  actions,
});

/** The built-in commands of the floating button of the columns. */
const pageActionPlugins: PageActionPlugin[] = [
  pageActionPlugin(
    {
      id: 'fluid-pharo-script',
      name: 'Pharo script',
      description: 'Run Smalltalk in the Pharo image on the entity of a detail column (self), served by Spec-Fluid.',
      settings: [specFluidEndpoint('Where the image serves Spec-Fluid; it evaluates scripts once SFServer enableEvaluation. Leave empty to turn it off.')],
    },
    [pharoScriptAction],
  ),
  pageActionPlugin(
    { id: 'fluid-fireworks', name: 'Fireworks', description: 'An easter egg: fireworks over the page, from the floating button of any column.' },
    [fireworksAction],
  ),
];

/** The id of the theme used when the chosen one is unavailable. */
export const DEFAULT_THEME_ID = BADETITOU_THEME.id;

/** Every plugin shipped with fluid: widget collections, view builders, sources, page actions, then themes. */
export const BUILTIN_PLUGINS: FluidPlugin[] = [
  ...widgetPlugins,
  ...viewBuilderPlugins,
  demoSourcesPlugin,
  ...pageActionPlugins,
  themePlugin(BADETITOU_THEME, true),
  themePlugin(SOLARIZED_THEME),
  themePlugin(HIGH_CONTRAST_THEME),
  themesPlugin(
    {
      id: 'fluid-theme-catppuccin',
      name: 'Catppuccin themes',
      description: 'The Catppuccin pastel palettes (catppuccin.com): Latte in light mode, Frappé, Macchiato or Mocha in dark mode, plus a matcha green variant.',
    },
    CATPPUCCIN_THEMES,
  ),
];
