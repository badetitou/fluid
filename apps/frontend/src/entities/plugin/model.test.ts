import { describe, expect, it } from 'vitest';
import {
  BUILTIN_WIDGET_COLLECTIONS,
  renderPortDocs,
  renderWidgetDocs,
  resolveWidgetCatalog,
  WIDGET_TYPES,
} from '@fluid/shared';
import { BUILTIN_PLUGINS, DEFAULT_THEME_ID } from './builtin';
import { pluginKind, pluginManifestSchema, type PluginManifest } from './manifest';
import {
  activeColumnOverlays,
  activeDataSources,
  activeViewBuilders,
  activeWidgetCatalog,
  availableThemes,
  catalogRequest,
  conflictingId,
  contractsOf,
  installedPlugin,
  pickTheme,
  renderersOf,
  settingsOf,
  themesOf,
} from './model';

const manifest: PluginManifest = {
  id: 'tagcloud',
  name: 'Tag cloud',
  version: '1.0.0',
  module: './index.js',
  contributes: {
    widgets: [
      {
        type: 'tagcloud/cloud',
        label: 'Tag cloud',
        description: 'Values sized by count.',
        llmDoc: '- { "id": string, "type": "tagcloud/cloud", "field": string }',
        inputs: [],
        outputs: [{ name: 'selected', shape: 'object', description: 'The clicked tag.' }],
        jsonSchema: { type: 'object' },
      },
    ],
  },
};
const tagcloud = installedPlugin(
  { url: 'https://x.io/manifest.json', manifest },
  { status: 'ready' },
);

describe('built-in plugins', () => {
  it('ship every built-in widget type exactly once', () => {
    const types = BUILTIN_PLUGINS.flatMap((p) => renderersOf(p).map((r) => r.type));
    expect(types.sort()).toEqual([...WIDGET_TYPES].sort());
    expect(BUILTIN_WIDGET_COLLECTIONS.flatMap((c) => c.types).sort()).toEqual(
      [...WIDGET_TYPES].sort(),
    );
  });

  it('give each renderer its contract', () => {
    for (const plugin of BUILTIN_PLUGINS) {
      expect(contractsOf(plugin).map((c) => c.type)).toEqual(renderersOf(plugin).map((r) => r.type));
    }
  });

  it('include the default theme, which cannot be disabled', () => {
    const themes = availableThemes(
      BUILTIN_PLUGINS,
      BUILTIN_PLUGINS.map((p) => p.manifest.id),
    );
    expect(themes.map((t) => t.id)).toEqual([DEFAULT_THEME_ID]);
  });
});

describe('activeWidgetCatalog', () => {
  it('renders the widgets of enabled plugins only, and says which plugin to enable', () => {
    const catalog = activeWidgetCatalog(BUILTIN_PLUGINS, ['fluid-charts']);
    expect(catalog.renderers.has('table')).toBe(true);
    expect(catalog.renderers.has('pie')).toBe(false);
    expect(catalog.explainMissing('pie')).toContain('“Charts”, which is disabled');
  });

  it('explains a widget whose plugin is missing or failed to load', () => {
    expect(activeWidgetCatalog(BUILTIN_PLUGINS, []).explainMissing('tagcloud/cloud')).toContain(
      'not installed',
    );
    const broken = installedPlugin({ url: 'u', manifest }, { status: 'error', message: 'boom' });
    expect(activeWidgetCatalog([broken], []).explainMissing('tagcloud/cloud')).toContain('boom');
  });

  it('keeps required plugins enabled', () => {
    expect(activeWidgetCatalog(BUILTIN_PLUGINS, ['fluid-essentials']).renderers.has('table')).toBe(
      true,
    );
  });
});

describe('catalogRequest', () => {
  it('sends the enabled built-in types and the plugin contracts', () => {
    const request = catalogRequest([...BUILTIN_PLUGINS, tagcloud], ['fluid-code']);
    expect(request.types).not.toContain('code');
    expect(request.types).toContain('pie');
    expect(request.external?.map((c) => c.type)).toEqual(['tagcloud/cloud']);
  });

  it('prompts with the enabled widgets only, and documents their outputs', () => {
    const contracts = resolveWidgetCatalog(
      catalogRequest([...BUILTIN_PLUGINS, tagcloud], ['fluid-charts']),
    );
    const docs = renderWidgetDocs(contracts, { withId: false });
    expect(docs).toContain('"type": "tagcloud/cloud"');
    expect(docs).not.toContain('"type": "pie"');
    expect(docs).not.toContain('"id": string');
    expect(renderPortDocs(contracts)).toContain('"@people"');
  });
});

describe('themes and installs', () => {
  it('falls back to the default theme when the chosen one is gone', () => {
    expect(pickTheme(availableThemes(BUILTIN_PLUGINS, []), 'nord', DEFAULT_THEME_ID).id).toBe(
      DEFAULT_THEME_ID,
    );
    expect(pickTheme(availableThemes(BUILTIN_PLUGINS, []), 'solarized', DEFAULT_THEME_ID).id).toBe(
      'solarized',
    );
  });

  it('refuses an id already used by another plugin, but allows reinstalling from the same URL', () => {
    expect(conflictingId(BUILTIN_PLUGINS, 'fluid-charts', 'https://x.io/m.json')).toBe(true);
    expect(conflictingId([tagcloud], 'tagcloud', 'https://x.io/manifest.json')).toBe(false);
  });
});

describe('pluginManifestSchema', () => {
  it('accepts a widget plugin with a module', () => {
    expect(pluginManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it('requires a module for widgets, and widget types prefixed by the plugin id', () => {
    const { module: _module, ...noModule } = manifest;
    expect(pluginManifestSchema.safeParse(noModule).success).toBe(false);
    const foreign = structuredClone(manifest);
    foreign.contributes.widgets![0].type = 'other/cloud';
    expect(pluginManifestSchema.safeParse(foreign).success).toBe(false);
  });

  it('accepts a theme-only plugin without code', () => {
    const theme = BUILTIN_PLUGINS.flatMap(themesOf)[0];
    const themeOnly = {
      id: 'nord',
      name: 'Nord',
      version: '1.0.0',
      contributes: { themes: [{ ...theme, id: 'nord' }] },
    };
    expect(pluginManifestSchema.safeParse(themeOnly).success).toBe(true);
  });

  it('accepts one kind of contribution per plugin, and the kind it says', () => {
    const theme = BUILTIN_PLUGINS.flatMap(themesOf)[0];
    const both = structuredClone(manifest);
    both.contributes.themes = [theme];
    expect(pluginManifestSchema.safeParse(both).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...manifest, kind: 'theme' }).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...manifest, kind: 'widget' }).success).toBe(true);
  });

  it('requires a module for view builders', () => {
    const builder = {
      id: 'inspectors',
      name: 'Inspectors',
      version: '1.0.0',
      contributes: { viewBuilders: [{ id: 'tabs', label: 'Tabs' }] },
    };
    expect(pluginManifestSchema.safeParse(builder).success).toBe(false);
    const parsed = pluginManifestSchema.parse({ ...builder, module: './index.js' });
    expect(pluginKind(parsed)).toBe('viewBuilder');
  });
});

describe('view builders', () => {
  const specFluid = BUILTIN_PLUGINS.find((p) => p.manifest.id === 'spec-fluid')!;

  it('are built in, curated before auto, Spec-Fluid last', () => {
    expect(activeViewBuilders(BUILTIN_PLUGINS, [], {}).map((b) => b.builder.id)).toEqual([
      'curated-views',
      'auto-views',
      'spec-fluid',
    ]);
    expect(activeViewBuilders(BUILTIN_PLUGINS, ['spec-fluid'], {}).map((b) => b.builder.id)).not.toContain(
      'spec-fluid',
    );
  });

  it('get their plugin settings, filled or empty', () => {
    expect(settingsOf(specFluid, {})).toEqual({ endpoint: '' });
    expect(settingsOf(specFluid, { 'spec-fluid': { endpoint: ' http://h/sf ', other: 'x' } })).toEqual({
      endpoint: 'http://h/sf',
    });
  });

  it('bring their data sources', () => {
    const sources = activeDataSources(activeViewBuilders(BUILTIN_PLUGINS, [], {}));
    expect([...sources.keys()]).toEqual(['spec-fluid']);
  });

  it('bring their column overlays', () => {
    const overlays = activeColumnOverlays(activeViewBuilders(BUILTIN_PLUGINS, [], { 'spec-fluid': { endpoint: 'http://h/sf' } }));
    expect(overlays.map((o) => [o.id, o.settings])).toEqual([['spec-fluid', { endpoint: 'http://h/sf' }]]);
  });
});
