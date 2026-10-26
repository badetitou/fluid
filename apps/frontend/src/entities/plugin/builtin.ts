import { BUILTIN_WIDGET_COLLECTIONS, BUILTIN_WIDGET_CONTRACTS } from '@fluid/shared';
import { BADETITOU_THEME, type ThemeDefinition } from '../../shared/theme';
import { builtinRenderer } from '../../views/widgets/catalog';
import { autoViewBuilder } from './builders/autoViews';
import { curatedViewBuilder } from './builders/curatedViews';
import { ENDPOINT_SETTING, specFluidViewBuilder } from './builders/specFluid';
import { HIGH_CONTRAST_THEME, SOLARIZED_THEME } from './builtinThemes';
import type { PluginManifest } from './manifest';
import type { FluidPlugin, ThemePlugin, ViewBuilderPlugin, WidgetPlugin } from './types';
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

const themePlugin = (theme: ThemeDefinition, required = false): ThemePlugin => ({
  ...BUILTIN,
  kind: 'theme',
  manifest: {
    id: `fluid-theme-${theme.id}`,
    name: `${theme.label} theme`,
    version: VERSION,
    kind: 'theme',
    description: theme.description,
    author: 'fluid',
    contributes: { themes: [theme] },
  },
  required,
  themes: [theme],
});

type BuilderManifest = Pick<PluginManifest, 'id' | 'name' | 'description' | 'settings'>;

const viewBuilderPlugin = (manifest: BuilderManifest, builder: ViewBuilder): ViewBuilderPlugin => ({
  ...BUILTIN,
  kind: 'viewBuilder',
  manifest: {
    ...manifest,
    version: VERSION,
    kind: 'viewBuilder',
    author: 'fluid',
    contributes: { viewBuilders: [{ id: builder.id, label: builder.label }] },
  },
  builders: [builder],
});

/** The built-in view builders, in the order their perspectives are listed (after the saved ones). */
const viewBuilderPlugins: ViewBuilderPlugin[] = [
  viewBuilderPlugin(
    { id: 'fluid-curated-views', name: 'Curated views', description: 'Example perspectives shipped with fluid for well-known concepts.' },
    curatedViewBuilder,
  ),
  viewBuilderPlugin(
    {
      id: 'fluid-auto-views',
      name: 'Automatic views',
      description: 'An overview of every concept, a detail of every item and a tree of hierarchies, built from the GraphQL schema.',
    },
    autoViewBuilder,
  ),
  viewBuilderPlugin(
    {
      id: 'spec-fluid',
      name: 'Spec-Fluid (Pharo inspectors)',
      description:
        'The inspector tabs Pharo defines for a Moose entity (Navigation, Fame, Blueprint, UML…), served by the Spec-Fluid project of the image, as perspectives of its detail column.',
      settings: [
        {
          key: ENDPOINT_SETTING,
          label: 'Spec-Fluid endpoint',
          description: 'Where the image serves Spec-Fluid (SFServer start). Leave empty to turn it off.',
          placeholder: 'http://localhost:8081/spec-fluid',
        },
      ],
    },
    specFluidViewBuilder,
  ),
];

/** The id of the theme used when the chosen one is unavailable. */
export const DEFAULT_THEME_ID = BADETITOU_THEME.id;

/** Every plugin shipped with fluid: widget collections, view builders, then themes. */
export const BUILTIN_PLUGINS: FluidPlugin[] = [
  ...widgetPlugins,
  ...viewBuilderPlugins,
  themePlugin(BADETITOU_THEME, true),
  themePlugin(SOLARIZED_THEME),
  themePlugin(HIGH_CONTRAST_THEME),
];
