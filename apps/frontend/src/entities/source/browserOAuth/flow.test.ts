// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createPendingSignIns, discoverAuthServer, finishSignIn, startSignIn, type AuthServer, type FetchLike } from './flow';
import { settingsFingerprint, type BrowserOAuthSettings } from './model';

const ISSUER = 'https://as.test';
const REDIRECT = 'https://fluid.test/oauth-callback.html';
const settings: BrowserOAuthSettings = { issuer: ISSUER, clientId: 'fluid', scopes: ['read'], resource: 'https://api.test' };
const metadata = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  code_challenge_methods_supported: ['S256'],
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fake network: `routes[url]` answers that URL, anything else is a 404. */
function network(routes: Record<string, (init?: RequestInit) => Response>) {
  return vi.fn<FetchLike>(async (url, init) => routes[url]?.(init) ?? new Response('not found', { status: 404 }));
}

describe('discovery', () => {
  it('tries RFC 8414 then OpenID Connect, and reads the endpoints', async () => {
    const fetchFn = network({ [`${ISSUER}/.well-known/openid-configuration`]: () => json(metadata) });
    const server = await discoverAuthServer(ISSUER, fetchFn);
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      `${ISSUER}/.well-known/oauth-authorization-server`,
      `${ISSUER}/.well-known/openid-configuration`,
    ]);
    expect(server).toMatchObject({ authorizationEndpoint: `${ISSUER}/authorize`, s256: true });
  });

  it('skips metadata for another issuer, or with http endpoints for an https issuer', async () => {
    const other = network({ [`${ISSUER}/.well-known/oauth-authorization-server`]: () => json({ ...metadata, issuer: 'https://evil.test' }) });
    await expect(discoverAuthServer(ISSUER, other)).rejects.toThrow(/No authorization server metadata/);
    const http = network({
      [`${ISSUER}/.well-known/oauth-authorization-server`]: () => json({ ...metadata, token_endpoint: 'http://as.test/token' }),
    });
    await expect(discoverAuthServer(ISSUER, http)).rejects.toThrow(/No authorization server metadata/);
  });
});

const server = async (over: Partial<typeof metadata> = {}): Promise<AuthServer> =>
  discoverAuthServer(ISSUER, network({ [`${ISSUER}/.well-known/oauth-authorization-server`]: () => json({ ...metadata, ...over }) }));

describe('authorization request', () => {
  it('sends PKCE S256, state, nonce, scopes and resource, as a public client', async () => {
    const { url, pending } = await startSignIn('https://api.test/graphql', settings, await server(), REDIRECT, 0, 'write');
    const params = new URL(url).searchParams;
    expect(url.startsWith(`${ISSUER}/authorize?`)).toBe(true);
    expect(Object.fromEntries(params)).toMatchObject({
      response_type: 'code',
      client_id: 'fluid',
      redirect_uri: REDIRECT,
      code_challenge_method: 'S256',
      scope: 'read write',
      resource: 'https://api.test',
      state: pending.state,
      nonce: pending.nonce,
    });
    expect(params.get('code_challenge')).not.toBe(pending.verifier);
    expect(params.has('client_secret')).toBe(false);
  });

  it('refuses to start without S256 in the metadata', async () => {
    const plain = await server({ code_challenge_methods_supported: ['plain'] });
    await expect(startSignIn('https://api.test/graphql', settings, plain, REDIRECT, 0)).rejects.toThrow(/S256/);
  });
});

describe('callback', () => {
  async function started(tokenAnswer: () => Response) {
    const token = vi.fn(tokenAnswer);
    const fetchFn = network({ [`${ISSUER}/token`]: (init) => token(init) });
    const { pending } = await startSignIn('https://api.test/graphql', settings, await server(), REDIRECT, 0);
    return { pending, fetchFn, token };
  }

  it('exchanges the code with the verifier and keeps only the access token', async () => {
    const { pending, fetchFn } = await started(() => json({ access_token: 'AT', token_type: 'Bearer', expires_in: 60, refresh_token: 'RT' }));
    const callback = new URL(`${REDIRECT}?code=CODE&state=${pending.state}`);
    const token = await finishSignIn(pending, callback, fetchFn, 1000);
    expect(token).toEqual({ accessToken: 'AT', expiresAt: 61_000, scope: 'read', fingerprint: settingsFingerprint(settings) });
    const body = new URLSearchParams(String(fetchFn.mock.calls[0][1]?.body));
    expect(Object.fromEntries(body)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'CODE',
      redirect_uri: REDIRECT,
      code_verifier: pending.verifier,
      client_id: 'fluid',
      resource: 'https://api.test',
    });
    expect(body.has('client_secret')).toBe(false);
  });

  it('rejects another state, an error answer, or another issuer, without calling the token endpoint', async () => {
    const { pending, fetchFn } = await started(() => json({ access_token: 'AT', token_type: 'bearer' }));
    for (const query of ['code=C&state=other', `error=access_denied&state=${pending.state}`, `code=C&state=${pending.state}&iss=https://evil.test`]) {
      await expect(finishSignIn(pending, new URL(`${REDIRECT}?${query}`), fetchFn, 0)).rejects.toThrow();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects a token endpoint error', async () => {
    const { pending, fetchFn } = await started(() => json({ error: 'invalid_grant' }, 400));
    await expect(finishSignIn(pending, new URL(`${REDIRECT}?code=C&state=${pending.state}`), fetchFn, 0)).rejects.toThrow();
  });
});

describe('pending sign-ins', () => {
  const entry = (state: string, sourceUrl = 'https://a.test', createdAt = 0) =>
    ({ state, sourceUrl, createdAt }) as Parameters<ReturnType<typeof createPendingSignIns>['add']>[0];

  it('gives each sign-in once, and not after it expired', () => {
    const pending = createPendingSignIns(1000);
    pending.add(entry('s1'));
    pending.add(entry('s2'));
    expect(pending.take('s1', 500)?.state).toBe('s1');
    expect(pending.take('s1', 500)).toBeNull();
    expect(pending.take('s2', 2000)).toBeNull();
    expect(pending.take(null, 0)).toBeNull();
  });

  it('drops the sign-ins of a source', () => {
    const pending = createPendingSignIns();
    pending.add(entry('s1', 'https://a.test'));
    pending.add(entry('s2', 'https://b.test'));
    pending.dropFor('https://a.test');
    expect(pending.take('s1', 0)).toBeNull();
    expect(pending.take('s2', 0)?.state).toBe('s2');
  });
});
