import { BUILTIN_WIDGET_COLLECTIONS, BUILTIN_WIDGET_CONTRACTS, noCyclesDecorator } from '@fluid/shared';
import { BADETITOU_THEME, type ThemeDefinition } from '../../shared/theme';
import { builtinRenderer } from '../../views/widgets/catalog';
import { autoViewBuilder } from './builders/autoViews';
import { curatedViewBuilder } from './builders/curatedViews';
import { chatAction } from './actions/chat';
import { fireworksAction } from './actions/fireworks';
import { ENDPOINTS_SETTING, openViewsBuilder } from './builders/openViews';
import { modelViewsBuilder } from './builders/modelViews';
import { HIGH_CONTRAST_THEME, SOLARIZED_THEME } from './builtinThemes';
import { CATPPUCCIN_THEMES } from './catppuccin';
import type { PluginManifest } from './manifest';
import type { PageAction } from './pageAction';
import { staticSourceProvider } from './sourceProvider';
import { DEMO_SOURCES } from './sources/demoSources';
import { githubSourceProvider } from './sources/github/provider';
import type { FluidPlugin, GraphDecoratorPlugin, PageActionPlugin, SourceProviderPlugin, ThemePlugin, ViewBuilderPlugin, WidgetPlugin } from './types';
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
const viewBuilderPlugins: ViewBuilderPlugin[] = [
  viewBuilderPlugin(
    { id: 'fluid-curated-views', name: 'Curated views', description: 'Example perspectives shipped with fluid for well-known concepts.' },
    curatedViewBuilder,
    '#eb2f96',
  ),
  viewBuilderPlugin(
    {
      id: 'fluid-model-views',
      name: 'Model views',
      description:
        'Code-model perspectives for sources serving badetitou/Model (recognised from their schema): the code tree, polymetric maps and dependency matrices of classes and packages, package flows pinned by layer, the members, inheritance and blueprint of a type, the callers and callees of a method.',
    },
    modelViewsBuilder,
    '#722ed1',
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
      id: 'fluid-open-views',
      name: 'Open Views',
      description:
        'The views any tool serves for its objects in the fluid Open Views format (<base>/.well-known/fluid-views), as perspectives of their detail columns.',
      settings: [
        {
          key: ENDPOINTS_SETTING,
          label: 'Open Views endpoints',
          description:
            'Base URLs of Open Views providers, one per line (or separated by commas), e.g. http://localhost:8081/spec-fluid for the Pharo image (SFServer start). Leave empty to turn it off.',
          placeholder: 'https://tool.example.org/views',
        },
      ],
    },
    openViewsBuilder,
    '#13c2c2',
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

const githubProvider = githubSourceProvider();

/** The public GitHub repositories the BFF analyses with Model; hidden when the BFF does not offer them. */
const githubSourcesPlugin: SourceProviderPlugin = {
  ...BUILTIN,
  kind: 'sourceProvider',
  manifest: {
    id: 'fluid-github-sources',
    name: 'GitHub repositories',
    version: VERSION,
    kind: 'sourceProvider',
    description:
      'Public GitHub repositories downloaded and analysed with Model by the BFF, explored like any GraphQL source. Shown when the BFF has the GitHub source on.',
    author: 'fluid',
    contributes: { sourceProviders: [{ id: githubProvider.id, label: githubProvider.label }] },
  },
  providers: [githubProvider],
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
    { id: 'fluid-fireworks', name: 'Fireworks', description: 'An easter egg: fireworks over the page, from the floating button of any column.' },
    [fireworksAction],
  ),
  pageActionPlugin(
    { id: 'fluid-chat', name: 'Chat', description: 'A chat with the LLM about the connected graph or the view of any column; it can answer with widgets.' },
    [chatAction],
  ),
];

const cyclesDecorator = noCyclesDecorator({ id: 'dependency-cycles', label: 'Dependency cycles' });

/** The built-in graph decorator: flags the dependency cycles of the connected graph. */
const graphDecoratorPlugins: GraphDecoratorPlugin[] = [
  {
    ...BUILTIN,
    kind: 'graphDecorator',
    manifest: {
      id: 'fluid-dependency-cycles',
      name: 'Dependency cycles',
      version: VERSION,
      kind: 'graphDecorator',
      description: 'Flags the cycles among the nodes of the connected graph.',
      author: 'fluid',
      contributes: { graphDecorators: [cyclesDecorator] },
    },
    decorators: [cyclesDecorator],
  },
];

/** The id of the theme used when the chosen one is unavailable. */
export const DEFAULT_THEME_ID = BADETITOU_THEME.id;

/** Every plugin shipped with fluid: widget collections, view builders, sources, page actions, graph decorators, then themes. */
export const BUILTIN_PLUGINS: FluidPlugin[] = [
  ...widgetPlugins,
  ...viewBuilderPlugins,
  demoSourcesPlugin,
  githubSourcesPlugin,
  ...pageActionPlugins,
  ...graphDecoratorPlugins,
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
