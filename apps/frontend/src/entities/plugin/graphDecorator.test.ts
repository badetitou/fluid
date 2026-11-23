import { noCyclesDecorator } from '@fluid/shared';
import { describe, expect, it } from 'vitest';
import { pluginContents } from '../../features/plugin-manager/model';
import { BUILTIN_PLUGINS } from './builtin';
import { activeGraphDecorators } from './graphDecorator';
import { contributionLabel, pluginKind, pluginManifestSchema } from './manifest';
import { installedPlugin } from './model';

const SPEC = noCyclesDecorator({ id: 'no-loops', label: 'No loops', severity: 'error' });
const MANIFEST = {
  id: 'loops',
  name: 'Loops',
  version: '1.0.0',
  contributes: { graphDecorators: [SPEC] },
};

const install = () =>
  installedPlugin(
    { url: 'https://example.org/loops/manifest.json', manifest: pluginManifestSchema.parse(MANIFEST) },
    { status: 'ready' },
  );

describe('graph decorator plugins', () => {
  it('accept a manifest of decorators, which needs no module', () => {
    const parsed = pluginManifestSchema.parse(MANIFEST);
    expect(pluginKind(parsed)).toBe('graphDecorator');
    expect(contributionLabel(parsed)).toBe('graph decorators');
    expect(pluginManifestSchema.safeParse({ ...MANIFEST, kind: 'graphDecorator' }).success).toBe(true);
  });

  it('refuse an invalid decorator spec, and a mix of kinds', () => {
    const bad = { ...MANIFEST, contributes: { graphDecorators: [{ id: 'Bad Id', label: '' }] } };
    expect(pluginManifestSchema.safeParse(bad).success).toBe(false);
    const mixed = { ...MANIFEST, contributes: { ...MANIFEST.contributes, pageActions: [{ id: 'x', label: 'X' }] }, module: './i.js' };
    expect(pluginManifestSchema.safeParse(mixed).success).toBe(false);
  });

  it('list the decorators of the enabled plugins only', () => {
    const plugins = [...BUILTIN_PLUGINS, install()];
    expect(activeGraphDecorators(plugins).map((d) => d.id)).toEqual(['dependency-cycles', 'no-loops']);
    expect(activeGraphDecorators(plugins, ['loops']).map((d) => d.id)).toEqual(['dependency-cycles']);
  });

  it('ship the dependency cycles decorator as a built-in plugin', () => {
    const builtin = BUILTIN_PLUGINS.find((p) => p.kind === 'graphDecorator')!;
    expect(builtin.manifest.id).toBe('fluid-dependency-cycles');
    expect(pluginManifestSchema.safeParse(builtin.manifest).success).toBe(true);
    expect(pluginContents(builtin)).toEqual(['Dependency cycles', 'no-cycle (warning)']);
  });
});
