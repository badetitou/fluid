import { describe, expect, it } from 'vitest';
import { BUILTIN_PLUGINS } from './builtin';
import { pluginKind, pluginManifestSchema } from './manifest';
import { activeSourceProviders, installedPlugin, providersOf } from './model';
import { checkedSourceProvider } from './sourceProvider';

const signal = new AbortController().signal;
const moose = { name: 'Moose (local)', url: 'http://localhost:8080/graphql' };

describe('source provider plugins', () => {
  it('need no module when they list their sources', () => {
    const manifest = {
      id: 'my-sources',
      name: 'My sources',
      version: '1.0.0',
      contributes: { sourceProviders: [{ id: 'local', label: 'Local', sources: [moose] }] },
    };
    const parsed = pluginManifestSchema.parse(manifest);
    expect(pluginKind(parsed)).toBe('sourceProvider');
    const plugin = installedPlugin({ url: 'https://x/manifest.json', manifest: parsed }, { status: 'loading' });
    expect(plugin.load.status).toBe('ready');
    expect(providersOf(plugin).map((p) => p.id)).toEqual(['local']);
  });

  it('may ship OAuth settings with a source, validated and without any secret', () => {
    const auth = { kind: 'oauth', issuer: 'https://auth.example.com', clientId: 'fluid', scopes: ['read'] };
    const entry = (extra: unknown) => ({
      id: 'p',
      name: 'P',
      version: '1.0.0',
      contributes: { sourceProviders: [{ id: 'x', label: 'X', sources: [{ ...moose, auth: extra }] }] },
    });
    const ok = pluginManifestSchema.safeParse(entry(auth));
    expect(ok.success && ok.data.contributes.sourceProviders?.[0].sources?.[0].auth).toEqual(auth);
    expect(pluginManifestSchema.safeParse(entry({ ...auth, clientSecret: 's3cret' })).success).toBe(false);
    expect(pluginManifestSchema.safeParse(entry({ ...auth, issuer: 'javascript:alert(1)' })).success).toBe(false);
    expect(pluginManifestSchema.safeParse(entry({ ...auth, kind: 'basic' })).success).toBe(false);
  });

  it('need a module when they fetch their sources', () => {
    const manifest = {
      id: 'moose-images',
      name: 'Moose images',
      version: '1.0.0',
      contributes: { sourceProviders: [{ id: 'images', label: 'Images' }] },
    };
    expect(pluginManifestSchema.safeParse(manifest).success).toBe(false);
    expect(pluginManifestSchema.safeParse({ ...manifest, module: './index.js' }).success).toBe(true);
  });

  it('only offer http(s) URLs', () => {
    const manifest = {
      id: 'bad',
      name: 'Bad',
      version: '1.0.0',
      contributes: { sourceProviders: [{ id: 'x', label: 'X', sources: [{ name: 'x', url: 'javascript:alert(1)' }] }] },
    };
    expect(pluginManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it('include the demo APIs, unless disabled', async () => {
    const active = activeSourceProviders(BUILTIN_PLUGINS, [], {});
    expect(active.map((a) => a.provider.id)).toEqual(['demo-apis']);
    const sources = await active[0].provider.listSources({}, signal);
    expect(sources.map((s) => s.name)).toContain('Rick and Morty');
    expect(activeSourceProviders(BUILTIN_PLUGINS, ['fluid-demo-sources'], {})).toEqual([]);
  });

  it('check what a module lists', async () => {
    const contract = { id: 'images', label: 'Images' };
    const good = checkedSourceProvider(contract, () => [moose]);
    await expect(good.listSources({}, signal)).resolves.toEqual([moose]);
    const bad = checkedSourceProvider(contract, async () => [{ name: 'no url' }]);
    await expect(bad.listSources({}, signal)).rejects.toThrow('invalid sources');
  });
});
