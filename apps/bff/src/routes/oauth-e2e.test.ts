import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from '../test-support/oauth-harness';

// The whole browser flow over real HTTP: the BFF's start route, the stub authorization server's
// auto-approving /authorize (a real request, redirect not followed), the BFF's callback, then the proxy.

describe('sign-in end to end through the stub authorization server', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it.each([
    { name: 'plain OAuth', scopes: ['read'] },
    { name: 'OpenID Connect', scopes: ['openid', 'read'] },
  ])('signs in and proxies a query: $name', async ({ scopes }) => {
    const { id } = await h.createSource({ oauth: { scopes } });

    // 1. The popup opens the BFF start URL: a redirect to the authorization server, with the binder cookie.
    const started = await h.start(id);
    expect(started.statusCode).toBe(302);
    const cookie = h.cookieOf(started);
    expect(cookie).toBeTruthy();
    const authorizeUrl = String(started.headers.location);
    expect(authorizeUrl.startsWith(`${h.as.base}/authorize`)).toBe(true);
    expect(new URL(authorizeUrl).searchParams.get('scope')?.split(' ')).toEqual(scopes);

    // 2. The browser follows it: the stub approves and redirects back to the BFF callback.
    const approved = await fetch(authorizeUrl, { redirect: 'manual' });
    expect(approved.status).toBe(302);
    const back = new URL(String(approved.headers.get('location')));
    expect(back.pathname).toBe('/api/oauth/callback');
    expect(back.searchParams.get('code')).toBeTruthy();

    // 3. The callback (with the cookie) completes the sign-in and tells the opener.
    const cb = await h.callback(back.searchParams.toString(), cookie);
    expect(cb.body).toContain('"ok":true');
    expect(cb.body).toContain(`"sourceId":"${id}"`);

    const config = (await h.app.inject({ method: 'GET', url: `/api/sources/${id}` })).json() as {
      oauth: { signedIn: boolean };
    };
    expect(config.oauth.signedIn).toBe(true);

    // 4. A proxied GraphQL query now reaches the resource with the token.
    const res = await h.run(id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { ok: true } });
    expect(h.resource.state.seen.at(-1)).toMatch(/^Bearer at-/);
  });
});
