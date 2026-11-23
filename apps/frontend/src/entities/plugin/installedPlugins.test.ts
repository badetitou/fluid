import { describe, expect, it } from 'vitest';
import nord from '../../../public/plugins/nord-theme/manifest.json';
import { validInstalledPlugins } from './installedPlugins';

const theme = { url: 'https://example.com/plugins/nord-theme/manifest.json', manifest: nord };

describe('validInstalledPlugins', () => {
  it('keeps the saved plugins whose manifest still validates', () => {
    expect(validInstalledPlugins([theme]).map((p) => p.manifest.id)).toEqual(['nord-theme']);
  });

  it('drops a plugin of a kind this build does not know, and malformed entries', () => {
    const decoration = {
      url: 'https://example.com/plugins/deco/manifest.json',
      manifest: { ...nord, id: 'deco', kind: 'decoration', contributes: { decorations: [{ id: 'x' }] } },
    };
    expect(validInstalledPlugins([decoration, theme, null, { url: 'x' }, 'nope']).map((p) => p.manifest.id)).toEqual(['nord-theme']);
  });

  it('reads nothing from a value that is not a list', () => {
    expect(validInstalledPlugins(undefined)).toEqual([]);
    expect(validInstalledPlugins({ installed: [] })).toEqual([]);
  });
});
