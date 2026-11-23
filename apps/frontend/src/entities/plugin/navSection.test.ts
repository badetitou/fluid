import { describe, expect, it } from 'vitest';
import { pluginKind, pluginManifestSchema } from './manifest';
import { installedPlugin } from './model';
import { activeNavSections, moduleNavSection, navPagePath, selectedNavKeys, shownNavSections } from './navSection';

const MANIFEST = {
  id: 'code-analysis',
  name: 'Code analysis',
  version: '1.0.0',
  module: './index.js',
  contributes: { navSections: [{ id: 'analysis', label: 'Code analysis', icon: '🔬' }] },
};
const useItems = () => [{ key: 'code-analysis:a', label: 'A', to: '/p/code-analysis/analysis' }];
const READY = { status: 'ready' } as const;

describe('nav section plugins', () => {
  it('accept a manifest of nav sections, which needs a module', () => {
    const parsed = pluginManifestSchema.parse(MANIFEST);
    expect(pluginKind(parsed)).toBe('navSection');
    const { module: _module, ...withoutModule } = MANIFEST;
    expect(pluginManifestSchema.safeParse(withoutModule).success).toBe(false);
  });

  it('refuse a module section that lists no entries', () => {
    const [contract] = MANIFEST.contributes.navSections;
    expect(() => moduleNavSection(contract, {})).toThrow(/does not list/);
    expect(moduleNavSection(contract, { useItems }).useItems).toBe(useItems);
  });

  it('are listed with their plugin settings, and left out when disabled', () => {
    const [contract] = MANIFEST.contributes.navSections;
    const plugin = installedPlugin(
      { url: 'https://x/manifest.json', manifest: pluginManifestSchema.parse(MANIFEST) },
      READY,
      { sections: [moduleNavSection(contract, { useItems })] },
    );
    expect(activeNavSections([plugin], [], {}).map((s) => s.key)).toEqual(['code-analysis/analysis']);
    expect(activeNavSections([plugin], ['code-analysis'], {})).toEqual([]);
  });

  it('are shown only where `available` says so', () => {
    const [contract] = MANIFEST.contributes.navSections;
    const plugin = installedPlugin(
      { url: 'https://x/manifest.json', manifest: pluginManifestSchema.parse(MANIFEST) },
      READY,
      { sections: [moduleNavSection(contract, { useItems, available: (c: { queriesByType: Map<string, unknown> }) => c.queriesByType.has('Class') })] },
    );
    const sections = activeNavSections([plugin], [], {});
    expect(shownNavSections(sections, new Map())).toEqual([]);
    expect(shownNavSections(sections, new Map([['Class', {}]]))).toHaveLength(1);
  });
});

describe('selectedNavKeys', () => {
  const items = [
    { key: 'a', label: 'A', to: '/p/x/y' },
    { key: 'b', label: 'B' },
  ];
  it('highlights the items whose path the page is under', () => {
    expect(selectedNavKeys('/p/x/y', items)).toEqual(['a']);
    expect(selectedNavKeys('/p/x/y/deep', items)).toEqual(['a']);
    expect(selectedNavKeys('/p/x/yz', items)).toEqual([]);
  });
  it('builds the path of a section page', () => {
    expect(navPagePath('x', 'y')).toBe('/p/x/y');
    expect(navPagePath('x', 'y', 'z')).toBe('/p/x/y/z');
  });
});
