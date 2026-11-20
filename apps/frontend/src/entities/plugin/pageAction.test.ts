import { describe, expect, it } from 'vitest';
import { BUILTIN_PLUGINS } from './builtin';
import { pluginKind, pluginManifestSchema } from './manifest';
import { installedPlugin } from './model';
import { activePageActions, isOffered, modulePageAction, type PageActionContext } from './pageAction';

const LIST = { concept: 'Class', columnKind: 'list', path: '/d/Class' } as const;
const DETAIL = {
  concept: 'Class',
  columnKind: 'detail',
  itemId: '1:1',
  path: '/d/Class/Class@1:1',
} as const;
const CONTEXT: PageActionContext = { settings: {}, palette: ['#f00'], mode: 'dark', column: LIST };
const MANIFEST = {
  id: 'confetti',
  name: 'Confetti',
  version: '1.0.0',
  module: './index.js',
  settings: [{ key: 'color', label: 'Colour' }],
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
    expect(keys).toEqual(['fluid-fireworks/fireworks', 'fluid-chat/chat', 'confetti/throw']);
    expect(activePageActions(plugins, ['fluid-fireworks'], {}).map((a) => a.key)).not.toContain(
      'fluid-fireworks/fireworks',
    );
    const confetti = activePageActions(plugins, [], { confetti: { color: ' red ' } }).at(-1)!;
    expect(confetti.settings).toEqual({ color: 'red' });
  });

  it('offer the fireworks on any column, an action asking for an entity only there', () => {
    const [fireworks] = activePageActions(BUILTIN_PLUGINS, [], {});
    expect(isOffered(fireworks.action, CONTEXT)).toBe(true);
    const onEntity = modulePageAction(MANIFEST.contributes.pageActions[0], {
      run: () => {},
      available: (context: PageActionContext) => context.column.columnKind === 'detail',
    });
    expect(isOffered(onEntity, CONTEXT)).toBe(false);
    expect(isOffered(onEntity, { ...CONTEXT, column: DETAIL })).toBe(true);
  });
});
