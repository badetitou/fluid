import { BUILTIN_WIDGET_COLLECTIONS, BUILTIN_WIDGET_CONTRACTS } from '@fluid/shared';
import { BADETITOU_THEME, type ThemeDefinition } from '../../shared/theme';
import { builtinRenderer } from '../../views/widgets/catalog';
import { HIGH_CONTRAST_THEME, SOLARIZED_THEME } from './builtinThemes';
import type { FluidPlugin } from './types';

const VERSION = '1.0.0';

/** The built-in widget collections, as plugins. */
const widgetPlugins: FluidPlugin[] = BUILTIN_WIDGET_COLLECTIONS.map((collection) => ({
  manifest: {
    id: collection.id,
    name: collection.name,
    version: VERSION,
    description: collection.description,
    author: 'fluid',
    contributes: { widgets: [] },
  },
  source: { kind: 'builtin' },
  required: collection.required,
  contracts: collection.types.map((type) => BUILTIN_WIDGET_CONTRACTS[type]),
  renderers: collection.types.map(builtinRenderer),
  themes: [],
  load: { status: 'ready' },
}));

const themePlugin = (theme: ThemeDefinition, required = false): FluidPlugin => ({
  manifest: {
    id: `fluid-theme-${theme.id}`,
    name: `${theme.label} theme`,
    version: VERSION,
    description: theme.description,
    author: 'fluid',
    contributes: { themes: [theme] },
  },
  source: { kind: 'builtin' },
  required,
  contracts: [],
  renderers: [],
  themes: [theme],
  load: { status: 'ready' },
});

/** The id of the theme used when the chosen one is unavailable. */
export const DEFAULT_THEME_ID = BADETITOU_THEME.id;

/** Every plugin shipped with fluid: widget collections first, then themes. */
export const BUILTIN_PLUGINS: FluidPlugin[] = [
  ...widgetPlugins,
  themePlugin(BADETITOU_THEME, true),
  themePlugin(SOLARIZED_THEME),
  themePlugin(HIGH_CONTRAST_THEME),
];
