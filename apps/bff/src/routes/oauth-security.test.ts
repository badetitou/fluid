import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHostCheck } from '../sources/host-policy';
import { CLIENT_SECRET } from '../test-support/oauth-stub';
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

describe('sign-in binding and races', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  const startFlow = async (id: string, query = '') => {
    const started = await h.start(id, query);
    const loc = new URL(started.headers.location as string);
    const code = h.as.issueCode(loc.searchParams.get('code_challenge') ?? '', loc.searchParams.get('redirect_uri') ?? '');
    return { started, loc, query: `code=${code}&state=${loc.searchParams.get('state')}`, cookie: h.cookieOf(started) };
  };

  it('sets an HttpOnly SameSite=Lax cookie at start and refuses a callback without the matching one', async () => {
    const { id } = await h.createSource();
    const f = await startFlow(id);
    expect(String(f.started.headers['set-cookie'])).toMatch(/HttpOnly.*SameSite=Lax/);
    expect(String(f.started.headers['set-cookie'])).toContain('Path=/api/oauth');
    const forged = await h.callback(f.query);
    expect(forged.body).toContain('"ok":false');
    expect(h.as.tokenCalls).toHaveLength(0);
    // The state was consumed by the refused attempt.
    expect((await h.callback(f.query, f.cookie)).body).toContain('"ok":false');
    const g = await startFlow(id);
    expect((await h.callback(g.query, 'fluid_oauth=somebody-else')).body).toContain('"ok":false');
    const ok = await startFlow(id);
    const done = await h.callback(ok.query, ok.cookie);
    expect(done.body).toContain('"ok":true');
    expect(String(done.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('posts to the UI origin given at start, validates it, and keeps tokens out of the message', async () => {
    const { id } = await h.createSource();
    const { cb } = await h.signIn(id, { query: '?origin=http://localhost:5173' });
    expect(cb.body).toContain('"http://localhost:5173"');
    expect(cb.body).not.toMatch(/at-\d|rt-\d|code-/);
    for (const origin of ['javascript:alert(1)', 'http://localhost:5173/path', 'not a url', 'ftp://h']) {
      expect((await h.start(id, `?origin=${encodeURIComponent(origin)}`)).statusCode, origin).toBe(400);
    }
  });

  it('sends the same redirect_uri at the code exchange as at start', async () => {
    const { id } = await h.createSource();
    const { location } = await h.signIn(id);
    expect(h.as.tokenCalls[0].params.get('redirect_uri')).toBe(location.searchParams.get('redirect_uri'));
  });

  it('fails cleanly when the source is deleted between start and callback', async () => {
    const { id } = await h.createSource();
    const f = await startFlow(id);
    await h.app.inject({ method: 'DELETE', url: `/api/sources/${id}` });
    const res = await h.callback(f.query, f.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('"ok":false');
    expect(h.as.tokenCalls).toHaveLength(0);
  });

  it('refuses a callback after sign-out or reconfiguration since the start', async () => {
    const { id } = await h.createSource();
    const f = await startFlow(id);
    await h.app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: { oauth: { scopes: ['write'] } } });
    expect((await h.callback(f.query, f.cookie)).body).toContain('"ok":false');
    expect(h.as.tokenCalls).toHaveLength(0);
  });

  it('does not store tokens when the source is reconfigured during the code exchange', async () => {
    const { id } = await h.createSource();
    const f = await startFlow(id);
    h.as.opts.tokenDelayMs = 200;
    const inFlight = h.callback(f.query, f.cookie);
    await new Promise((r) => setTimeout(r, 60));
    await h.app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: { oauth: { clientId: 'other' } } });
    expect((await inFlight).body).toContain('"ok":false');
    expect(await h.storage.prisma.oAuthCredential.count({ where: { sourceId: id } })).toBe(0);
  });

  it('does not resurrect a credential when the user signs out during a refresh', async () => {
    h.as.opts.expiresIn = 120;
    const { id } = await h.createSource();
    await h.signIn(id);
    h.clock.t += 61_000;
    h.as.opts.tokenDelayMs = 200;
    const inFlight = h.run(id);
    await new Promise((r) => setTimeout(r, 60));
    await h.app.inject({ method: 'DELETE', url: `/api/sources/${id}/oauth/credential` });
    expect((await inFlight).statusCode).toBe(401);
    expect(await h.storage.prisma.oAuthCredential.count({ where: { sourceId: id } })).toBe(0);
  });

  it.each([
    ['url host', (h: Harness) => ({ url: h.resource.graphqlUrl().replace('127.0.0.1', 'localhost') })],
    ['issuer', () => ({ oauth: { issuer: 'http://127.0.0.1:1' } })],
    ['resource', () => ({ oauth: { resource: 'https://api.example/' } })],
    ['client secret', () => ({ oauth: { clientSecret: 'a-new-secret' } })],
    ['scopes', () => ({ oauth: { scopes: ['read', 'write'] } })],
  ])('signs out when the %s changes', async (_name, change) => {
    const { id } = await h.createSource();
    await h.signIn(id);
    const res = await h.app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: change(h) });
    expect(res.statusCode).toBe(200);
    expect(res.json().oauth.signedIn).toBe(false);
  });

  it('falls back to the requested scopes when the token response names none', async () => {
    h.as.opts.codeScope = null;
    const { id } = await h.createSource({ oauth: { scopes: ['read', 'write'] } });
    await h.signIn(id);
    expect((await h.app.inject({ url: `/api/sources/${id}` })).json().oauth.grantedScopes).toEqual(['read', 'write']);
  });

  it('accepts an ID token with the matching nonce and refuses a wrong one (openid scope)', async () => {
    const { id } = await h.createSource({ oauth: { scopes: ['openid', 'read'] } });
    expect((await h.signIn(id)).cb.body).toContain('"ok":true');
    await h.app.inject({ method: 'DELETE', url: `/api/sources/${id}/oauth/credential` });
    const wrong = await h.signIn(id, { idTokenNonce: 'not-the-nonce' });
    expect(wrong.cb.body).toContain('"ok":false');
    expect((await h.app.inject({ url: `/api/sources/${id}` })).json().oauth.signedIn).toBe(false);
  });

  it('never logs codes, state, tokens or secrets on failure paths either', async () => {
    const { id } = await h.createSource();
    const f = await startFlow(id);
    await h.callback(f.query); // no cookie: refused
    h.as.opts.refreshFails = true;
    const good = await h.signIn(id);
    h.clock.t += 4000_000;
    await h.run(id);
    const text = h.logs.join('');
    const state = f.loc.searchParams.get('state') ?? 'x';
    for (const secret of [CLIENT_SECRET, f.query.split('&')[0].slice(5), state, good.code, f.cookie.split('=')[1]]) {
      expect(text).not.toContain(secret);
    }
    expect(h.logs.join('')).toContain('binder_mismatch');
  });
});
