import { describe, expect, it } from 'vitest';
import { BUILDER_PALETTE, builderColors } from './builderColors';
import { BUILTIN_PLUGINS } from './builtin';
import { activeViewBuilders, installedPlugin } from './model';

const installed = (id: string, color?: string) =>
  installedPlugin(
    {
      url: `https://example.org/${id}/manifest.json`,
      manifest: { id, name: id, version: '1', module: './index.js', contributes: { viewBuilders: [{ id, label: id, color }] } },
    },
    { status: 'ready' },
  );

describe('builderColors', () => {
  it('gives each built-in view builder a colour of its own', () => {
    const colors = builderColors(BUILTIN_PLUGINS, {});
    expect([...colors.keys()]).toEqual(['curated-views', 'auto-views', 'spec-fluid']);
    expect(new Set(colors.values()).size).toBe(3);
  });

  it('prefers the colour the user chose, when it is one', () => {
    const colors = builderColors(BUILTIN_PLUGINS, { 'auto-views': '#123456', 'spec-fluid': 'red' });
    expect(colors.get('auto-views')).toBe('#123456');
    expect(colors.get('spec-fluid')).toBe(builderColors(BUILTIN_PLUGINS, {}).get('spec-fluid'));
  });

  it('gives the palette in turn to builders that declare no colour', () => {
    const colors = builderColors([installed('a'), installed('b', '#000000'), installed('c')], {});
    expect([...colors.values()]).toEqual([BUILDER_PALETTE[0], '#000000', BUILDER_PALETTE[1]]);
  });

  it('marks the active view builders with their colour', () => {
    const active = activeViewBuilders(BUILTIN_PLUGINS, [], {}, { 'curated-views': '#abcdef' });
    expect(active.find((b) => b.builder.id === 'curated-views')?.color).toBe('#abcdef');
  });
});
