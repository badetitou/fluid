import { noCyclesDecorator } from '@fluid/shared';
import { describe, expect, it } from 'vitest';
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
    const bad = { ...MANIFEST, kind: 'graphDecorator', contributes: { graphDecorators: [{ id: 'Bad Id', label: '' }] } };
    const result = pluginManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('contributes.graphDecorators.0.id');
    expect(paths).toContain('contributes.graphDecorators.0.label');
    const mixed = { ...MANIFEST, contributes: { ...MANIFEST.contributes, pageActions: [{ id: 'x', label: 'X' }] }, module: './i.js' };
    const mixedResult = pluginManifestSchema.safeParse(mixed);
    expect(mixedResult.error!.issues.map((i) => i.message)).toContain(
      'A plugin contributes themes, widgets, viewBuilders, sourceProviders, pageActions, graphDecorators or navSections (one kind only)',
    );
  });

  it('list the decorators of the enabled plugins only', () => {
    const plugins = [...BUILTIN_PLUGINS, install()];
    expect(activeGraphDecorators(plugins).map((d) => d.id)).toEqual(['dependency-cycles', 'no-loops']);
    expect(activeGraphDecorators(plugins, ['loops']).map((d) => d.id)).toEqual(['dependency-cycles']);
  });

  it('keep the first decorator of an id, the built-in one included', () => {
    const twin = { ...SPEC, label: 'Other' };
    const dup = (id: string, spec = twin) =>
      installedPlugin(
        {
          url: `https://example.org/${id}/manifest.json`,
          manifest: pluginManifestSchema.parse({ ...MANIFEST, id, contributes: { graphDecorators: [spec] } }),
        },
        { status: 'ready' },
      );
    const shadow = dup('shadow', { ...twin, id: 'dependency-cycles' });
    const plugins = [...BUILTIN_PLUGINS, shadow, dup('first'), dup('second')];
    const found = activeGraphDecorators(plugins);
    expect(found.map((d) => d.id)).toEqual(['dependency-cycles', 'no-loops']);
    expect(found[0].label).toBe('Dependency cycles');
    expect(found[1].label).toBe('Other');
  });

  it('ship the dependency cycles decorator as a built-in plugin', () => {
    const builtin = BUILTIN_PLUGINS.find((p) => p.kind === 'graphDecorator')!;
    expect(builtin.manifest.id).toBe('fluid-dependency-cycles');
    expect(pluginManifestSchema.safeParse(builtin.manifest).success).toBe(true);
  });
});
