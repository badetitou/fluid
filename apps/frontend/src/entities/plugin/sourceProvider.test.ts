import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_PLUGINS } from './builtin';
import { pluginKind, pluginManifestSchema } from './manifest';
import { activeSourceProviders, installedPlugin, providersOf } from './model';
import { checkedSourceProvider, nextPollDelay } from './sourceProvider';

const signal = new AbortController().signal;
const moose = { name: 'Moose (local)', url: 'http://localhost:8080/graphql' };
const contract = { id: 'images', label: 'Images' };

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
    expect(active.map((a) => a.provider.id)).toEqual(['demo-apis', 'github']);
    const sources = await active[0].provider.listSources({}, signal);
    expect(sources.map((s) => s.name)).toContain('Rick and Morty');
    const left = activeSourceProviders(BUILTIN_PLUGINS, ['fluid-demo-sources'], {});
    expect(left.map((a) => a.provider.id)).toEqual(['github']);
  });

  it('check what a module lists', async () => {
    const good = checkedSourceProvider(contract, { listSources: () => [moose] });
    await expect(good.listSources({}, signal)).resolves.toEqual([moose]);
    const bad = checkedSourceProvider(contract, { listSources: async () => [{ name: 'no url' }] });
    await expect(bad.listSources({}, signal)).rejects.toThrow('invalid sources');
  });

  it('may mark a source pending', async () => {
    const provider = checkedSourceProvider(contract, { listSources: () => [{ ...moose, pending: true }] });
    await expect(provider.listSources({}, signal)).resolves.toEqual([{ ...moose, pending: true }]);
  });

  it('may offer an add form, checked, which gets the input and the settings', async () => {
    const submit = vi.fn().mockResolvedValue('ignored');
    const provider = checkedSourceProvider(contract, {
      listSources: () => [],
      addSource: { label: 'Analyse a repository', placeholder: 'owner/name', submit },
      pollMs: 2000,
    });
    expect(provider.addSource).toMatchObject({ label: 'Analyse a repository', placeholder: 'owner/name' });
    expect(provider.pollMs).toBe(2000);
    await expect(provider.addSource?.submit('a/b', { bff: 'x' }, signal)).resolves.toBeUndefined();
    expect(submit).toHaveBeenCalledWith('a/b', { bff: 'x' }, signal);
    expect(() => checkedSourceProvider(contract, { listSources: () => [], addSource: { label: 'x' } })).toThrow(
      'invalid add form',
    );
    expect(() => checkedSourceProvider(contract, { listSources: () => [], pollMs: 10 })).toThrow('invalid pollMs');
  });

  it('are polled at the shortest pollMs among those with a pending source', () => {
    const providers = [
      { id: 'a', pollMs: 5000 },
      { id: 'b', pollMs: 2000 },
      { id: 'c' },
    ];
    const group = (providerId: string, pending: boolean) => ({ providerId, sources: [{ pending }] });
    expect(nextPollDelay(providers, [group('a', false), group('b', false)])).toBeUndefined();
    expect(nextPollDelay(providers, [group('a', true), group('b', false)])).toBe(5000);
    expect(nextPollDelay(providers, [group('a', true), group('b', true)])).toBe(2000);
    expect(nextPollDelay(providers, [group('c', true)])).toBeUndefined();
    expect(nextPollDelay([{ id: 'a', pollMs: 1 }], [group('a', true)])).toBe(1000);
  });
});
