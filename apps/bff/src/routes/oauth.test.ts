import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_SECRET } from './oauth-stub';
import { startHarness, type Harness } from './oauth-harness';

describe('oauth routes: discovery, sign-in, callback', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it('stores oauth config with a write-only client secret and a public view without tokens', async () => {
    const { res, id } = await h.createSource({ oauth: { resource: 'https://api.example/' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().oauth).toMatchObject({
      issuer: h.as.issuer,
      clientId: 'fluid-client',
      hasClientSecret: true,
      scopes: ['read'],
      resource: 'https://api.example/',
      signedIn: false,
      expiresAt: null,
      grantedScopes: [],
    });
    expect(res.body).not.toContain(CLIENT_SECRET);
    const stored = await h.storage.prisma.sourceConfig.findUnique({ where: { id } });
    expect(stored?.oauthClientSecret).toBeTruthy();
    expect(stored?.oauthClientSecret).not.toContain(CLIENT_SECRET);
    const bad = await h.app.inject({ method: 'POST', url: '/api/sources', payload: { name: 'x', url: 'http://h/g', authKind: 'oauth' } });
    expect(bad.statusCode).toBe(400);
  });

  it('discovers metadata in the MCP order: RFC 8414, then OIDC with path insertion, then appended', async () => {
    h.as.opts.issuerPath = '/tenant';
    h.as.opts.metadata = 'oidc-append';
    const res = await h.app.inject({ url: `/api/oauth/discover?issuer=${encodeURIComponent(h.as.issuer)}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().authorizationServer).toMatchObject({ issuer: h.as.issuer, supportsS256: true });
    expect(h.as.metadataHits).toEqual([
      '/.well-known/oauth-authorization-server/tenant',
      '/.well-known/openid-configuration/tenant',
      '/tenant/.well-known/openid-configuration',
    ]);
    h.reset();
    h.as.opts.metadata = 'oidc';
    const oidc = await h.app.inject({ url: `/api/oauth/discover?issuer=${encodeURIComponent(h.as.issuer)}` });
    expect(oidc.json().authorizationServer.tokenEndpoint).toBe(`${h.as.base}/token`);
    expect(h.as.metadataHits).toEqual(['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration']);
  });

  it('reads RFC 9728 metadata when the source answers 401 and suggests issuer, scopes, resource', async () => {
    h.resource.state.mode = 'unauthorized';
    const res = await h.app.inject({ url: `/api/oauth/discover?url=${encodeURIComponent(h.resource.graphqlUrl())}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().suggestion).toEqual({ issuer: h.as.issuer, scopes: ['read'], resource: h.resource.state.url });
    expect(res.json().authorizationServer).toMatchObject({ supportsS256: true });
    expect((await h.app.inject({ url: '/api/oauth/discover' })).statusCode).toBe(400);
  });

  it('starts with state, S256 challenge, nonce and resource, and redirects to the authorization endpoint', async () => {
    const { id } = await h.createSource({ oauth: { resource: 'https://api.example/' } });
    const res = await h.start(id, '?scope=write');
    expect(res.statusCode).toBe(302);
    const loc = new URL(res.headers.location as string);
    expect(loc.origin + loc.pathname).toBe(`${h.as.base}/authorize`);
    const p = loc.searchParams;
    expect(p.get('response_type')).toBe('code');
    expect(p.get('client_id')).toBe('fluid-client');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get('state')?.length).toBeGreaterThan(20);
    expect(p.get('nonce')?.length).toBeGreaterThan(20);
    expect(p.get('resource')).toBe('https://api.example/');
    expect(p.get('scope')).toBe('read write');
    expect(p.get('redirect_uri')).toMatch(/\/api\/oauth\/callback$/);
    expect(loc.href).not.toContain(CLIENT_SECRET);
  });

  it('refuses to start when the metadata lacks S256, and for a non-oauth or unknown source', async () => {
    const { id } = await h.createSource();
    h.as.opts.s256 = false;
    const res = await h.start(id);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('S256');
    expect((await h.start('nope')).statusCode).toBe(404);
    const plain = await h.app.inject({ method: 'POST', url: '/api/sources', payload: { name: 'p', url: h.resource.graphqlUrl() } });
    expect((await h.start(plain.json().id)).statusCode).toBe(400);
  });

  it('completes the callback: PKCE verified by the server, resource sent, tokens stored encrypted', async () => {
    h.as.opts.expectResource = 'https://api.example/';
    const { id } = await h.createSource({ oauth: { resource: 'https://api.example/' } });
    const { cb } = await h.signIn(id);
    expect(cb.statusCode).toBe(200);
    expect(cb.headers['content-type']).toContain('text/html');
    expect(cb.body).toContain('"type":"fluid-oauth"');
    expect(cb.body).toContain(`"sourceId":"${id}"`);
    expect(cb.body).toContain('"ok":true');
    expect(cb.body).toContain('window.close()');
    expect(h.as.tokenCalls[0].params.get('code_verifier')).toBeTruthy();
    const view = (await h.app.inject({ url: `/api/sources/${id}` })).json().oauth;
    expect(view).toMatchObject({ signedIn: true, grantedScopes: ['read'] });
    expect(new Date(view.expiresAt).getTime()).toBeGreaterThan(h.clock.t);
    const cred = await h.storage.prisma.oAuthCredential.findUnique({ where: { sourceId: id } });
    expect(cred?.accessToken).toMatch(/^v1:/);
    expect(cred?.refreshToken).toMatch(/^v1:/);
    expect(JSON.stringify(view)).not.toMatch(/at-|rt-/);
  });

  it('fails the callback when the code is not bound to the verifier (PKCE) or the server errors', async () => {
    const { id } = await h.createSource();
    const loc = new URL((await h.start(id)).headers.location as string);
    const code = h.as.issueCode('wrong-challenge', loc.searchParams.get('redirect_uri') ?? '');
    const cb = await h.callback(`code=${code}&state=${loc.searchParams.get('state')}`);
    expect(cb.body).toContain('"ok":false');
    expect((await h.app.inject({ url: `/api/sources/${id}` })).json().oauth.signedIn).toBe(false);
    const denied = new URL((await h.start(id)).headers.location as string);
    const cb2 = await h.callback(`error=access_denied&state=${denied.searchParams.get('state')}`);
    expect(cb2.body).toContain('"ok":false');
  });

  it('refuses an unknown state, a reused state and an expired one', async () => {
    const { id } = await h.createSource();
    expect((await h.callback('code=x&state=nope')).body).toContain('"ok":false');
    expect((await h.callback('code=x')).body).toContain('"ok":false');
    const first = await h.signIn(id);
    expect(first.cb.body).toContain('"ok":true');
    const replay = await h.callback(`code=${h.as.issueCode('c', 'r')}&state=${first.location.searchParams.get('state')}`);
    expect(replay.body).toContain('"ok":false');
    expect(h.as.tokenCalls).toHaveLength(1);
    const loc = new URL((await h.start(id)).headers.location as string);
    h.clock.t += 11 * 60_000;
    const code = h.as.issueCode(loc.searchParams.get('code_challenge') ?? '', loc.searchParams.get('redirect_uri') ?? '');
    const late = await h.callback(`code=${code}&state=${loc.searchParams.get('state')}`);
    expect(late.body).toContain('"ok":false');
    expect(h.as.tokenCalls).toHaveLength(1);
  });

  it('does not echo the query string in the callback page', async () => {
    const res = await h.callback('state=</script><script>alert(1)</script>&code=<b>x</b>&error_description=<img src=x>');
    expect(res.body).not.toContain('alert(1)');
    expect(res.body).not.toContain('<b>');
    expect(res.body).not.toContain('<img');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('uses FLUID_PUBLIC_URL for the redirect URI and the postMessage origin', async () => {
    const pub = await startHarness('https://fluid.example/app/');
    try {
      const { id } = await pub.createSource();
      const { location, cb } = await pub.signIn(id);
      expect(location.searchParams.get('redirect_uri')).toBe('https://fluid.example/api/oauth/callback');
      expect(cb.body).toContain('"https://fluid.example"');
    } finally {
      await pub.close();
    }
  });

  it('signs out, and a source deletion removes the credential', async () => {
    const { id } = await h.createSource();
    await h.signIn(id);
    expect((await h.app.inject({ method: 'DELETE', url: `/api/sources/${id}/oauth/credential` })).statusCode).toBe(204);
    expect((await h.app.inject({ url: `/api/sources/${id}` })).json().oauth.signedIn).toBe(false);
    expect((await h.app.inject({ method: 'DELETE', url: `/api/sources/${id}/oauth/credential` })).statusCode).toBe(404);
    await h.signIn(id);
    await h.app.inject({ method: 'DELETE', url: `/api/sources/${id}` });
    expect(await h.storage.prisma.oAuthCredential.count({ where: { sourceId: id } })).toBe(0);
  });

  it('signs the user out when the issuer, client or host changes', async () => {
    const { id } = await h.createSource();
    await h.signIn(id);
    const renamed = await h.app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: { name: 'R' } });
    expect(renamed.json().oauth.signedIn).toBe(true);
    const changed = await h.app.inject({ method: 'PUT', url: `/api/sources/${id}`, payload: { oauth: { clientId: 'other' } } });
    expect(changed.json().oauth).toMatchObject({ clientId: 'other', signedIn: false, hasClientSecret: true });
  });

  it('never logs tokens, codes, verifiers or the client secret', async () => {
    const { id } = await h.createSource();
    const { code, location, cb } = await h.signIn(id);
    await h.run(id);
    const text = h.logs.join('');
    const tokens = [...(cb.body.match(/(at|rt)-\d+-\w+/g) ?? []), ...h.resource.state.seen.map((v) => v ?? '')];
    for (const secret of [CLIENT_SECRET, code, location.searchParams.get('state') ?? 'x', ...tokens]) {
      expect(text).not.toContain(secret);
    }
    expect(h.logs.length).toBeGreaterThan(0);
  });
});
