import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHostCheck } from '../sources/host-policy';
import { startHarness, type Harness } from '../test-support/oauth-harness';

const discover = (h: Harness, q: { url?: string; issuer?: string }) =>
  h.app.inject({ url: `/api/oauth/discover?${new URLSearchParams(q as Record<string, string>)}` });

describe('oauth outbound requests: host policy and URL checks', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it('rejects non-http(s) issuers and urls, and issuers with a query or fragment, without any outbound hit', async () => {
    for (const q of [
      { issuer: 'ftp://127.0.0.1/x' },
      { issuer: 'file:///etc/passwd' },
      { url: 'file:///etc/passwd' },
      { url: 'ftp://h/x' },
      { issuer: `${h.as.base}?x=1` },
      { issuer: `${h.as.base}#frag` },
    ]) {
      expect((await discover(h, q)).statusCode, JSON.stringify(q)).toBe(400);
    }
    expect(h.as.metadataHits).toEqual([]);
    const bad = await h.app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: { name: 'x', url: 'http://h/g', authKind: 'oauth', oauth: { issuer: 'https://i.test/?q=1', clientId: 'c' } },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('always refuses link-local and metadata addresses (discovery, proxy)', async () => {
    const issuer = await discover(h, { issuer: 'http://169.254.169.254' });
    expect(issuer.json().authorizationServer).toBeNull();
    const probe = await discover(h, { url: 'http://169.254.169.254/graphql' });
    expect(probe.json().resource).toBeNull();
    const created = await h.app.inject({ method: 'POST', url: '/api/sources', payload: { name: 'm', url: 'http://[::ffff:169.254.169.254]/graphql' } });
    const res = await h.app.inject({ method: 'POST', url: `/api/sources/${created.json().id}/graphql`, payload: { query: '{ a }' } });
    expect(res.statusCode).toBe(502);
    expect(res.json().errors[0].message).toContain('not allowed');
  });

  it('allows loopback by default (the stub servers run there)', async () => {
    expect((await discover(h, { issuer: h.as.issuer })).json().authorizationServer).not.toBeNull();
  });

  it('ignores protected resource metadata on another origin or for another resource', async () => {
    h.resource.state.mode = 'unauthorized';
    const url = h.resource.graphqlUrl();
    h.resource.state.prmUrl = `${h.as.base}/.well-known/oauth-protected-resource`;
    const elsewhere = await discover(h, { url });
    expect(elsewhere.json().resource).toBeNull();
    expect(elsewhere.json().suggestion.issuer).toBeNull();
    expect(h.as.metadataHits).toEqual([]);
    h.resource.state.prmUrl = null;
    h.resource.state.prmResource = 'https://another-api.example';
    expect((await discover(h, { url })).json().resource).toBeNull();
  });
});

describe('strict mode (FLUID_BLOCK_PRIVATE_HOSTS)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness({ hostCheck: createHostCheck({ blockPrivate: true }) });
  });
  afterAll(() => h.close());

  it('refuses loopback hosts for discovery and for the proxy', async () => {
    expect((await discover(h, { issuer: h.as.issuer })).json().authorizationServer).toBeNull();
    expect(h.as.metadataHits).toEqual([]);
    const created = await h.app.inject({ method: 'POST', url: '/api/sources', payload: { name: 'l', url: h.resource.graphqlUrl() } });
    const res = await h.app.inject({ method: 'POST', url: `/api/sources/${created.json().id}/graphql`, payload: { query: '{ a }' } });
    expect(res.statusCode).toBe(502);
    expect(h.resource.state.seen).toHaveLength(0);
  });
});
