import { describe, expect, it } from 'vitest';
import { BUILTIN_PLUGINS } from './builtin';
import { pluginKind, pluginManifestSchema } from './manifest';
import { installedPlugin } from './model';
import {
  activePageActions,
  isOffered,
  modulePageAction,
  type PageActionContext,
} from './pageAction';

const CONTEXT: PageActionContext = { settings: {}, palette: ['#f00'], mode: 'dark' };
const MANIFEST = {
  id: 'confetti',
  name: 'Confetti',
  version: '1.0.0',
  module: './index.js',
  contributes: { pageActions: [{ id: 'throw', label: 'Throw confetti', icon: '🎉' }] },
};

describe('page action plugins', () => {
  it('accept a manifest of page actions, which needs a module', () => {
    const parsed = pluginManifestSchema.parse(MANIFEST);
    expect(pluginKind(parsed)).toBe('pageAction');
    expect(pluginManifestSchema.safeParse({ ...MANIFEST, module: undefined }).success).toBe(false);
    expect(
      pluginManifestSchema.safeParse({
        ...MANIFEST,
        contributes: {
          ...MANIFEST.contributes,
          sourceProviders: [{ id: 'x', label: 'X', sources: [] }],
        },
      }).success,
    ).toBe(false);
  });

  it('take from the module what runs or draws each action', () => {
    const contract = MANIFEST.contributes.pageActions[0];
    const action = modulePageAction(contract, { run: () => {}, available: () => false });
    expect(action).toMatchObject({ id: 'throw', label: 'Throw confetti', icon: '🎉' });
    expect(isOffered(action, CONTEXT)).toBe(false);
    expect(() => modulePageAction(contract, { run: 'nope' })).toThrow(/neither runs nor draws/);
  });

  it('list the actions of the enabled plugins, keyed by plugin, with their settings', () => {
    const run = () => {};
    const installed = installedPlugin(
      {
        url: 'https://example.org/confetti/manifest.json',
        manifest: pluginManifestSchema.parse(MANIFEST),
      },
      { status: 'ready' },
      { actions: [{ id: 'throw', label: 'Throw confetti', run }] },
    );
    const plugins = [...BUILTIN_PLUGINS, installed];
    const keys = activePageActions(plugins, [], {}).map((a) => a.key);
    expect(keys).toEqual([
      'fluid-pharo-script/pharo-script',
      'fluid-fireworks/fireworks',
      'confetti/throw',
    ]);
    expect(activePageActions(plugins, ['fluid-fireworks'], {}).map((a) => a.key)).not.toContain(
      'fluid-fireworks/fireworks',
    );
    const pharo = activePageActions(plugins, [], {
      'fluid-pharo-script': { endpoint: 'http://localhost:8081/spec-fluid' },
    })[0];
    expect(pharo.settings).toEqual({ endpoint: 'http://localhost:8081/spec-fluid' });
  });

  it('offer the fireworks on any page, the Pharo script only on an entity', () => {
    const [pharo, fireworks] = activePageActions(BUILTIN_PLUGINS, [], {
      'fluid-pharo-script': { endpoint: 'http://x' },
    });
    expect(isOffered(fireworks.action, CONTEXT)).toBe(true);
    const settings = pharo.settings;
    expect(isOffered(pharo.action, { ...CONTEXT, settings })).toBe(false);
    expect(
      isOffered(pharo.action, {
        ...CONTEXT,
        settings,
        focus: { concept: 'Class', itemId: '1:1', path: '/d/Class/Class@1:1' },
      }),
    ).toBe(true);
  });
});
