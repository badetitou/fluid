import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_SECRET } from './oauth-stub';
import { startHarness, type Harness } from './oauth-harness';

describe('oauth sources through the GraphQL proxy', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  const authError = (res: { json: () => { errors: { extensions: unknown }[] } }) => res.json().errors[0].extensions;

  it('answers FLUID_AUTH_REQUIRED / signin (401) without a credential, without calling the source', async () => {
    const { id } = await h.createSource();
    const res = await h.run(id);
    expect(res.statusCode).toBe(401);
    expect(authError(res)).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'signin' });
    expect(h.resource.state.seen).toHaveLength(0);
  });

  it('attaches the bearer token once signed in, and never returns it', async () => {
    const { id } = await h.createSource();
    await h.signIn(id);
    const res = await h.run(id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { ok: true } });
    expect(h.resource.state.seen[0]).toMatch(/^Bearer at-/);
    expect(res.body).not.toContain('at-');
    expect(res.body).not.toContain(CLIENT_SECRET);
  });

  it('turns an upstream 401 into reason expired, and a 403 insufficient_scope into reason + scope', async () => {
    const { id } = await h.createSource();
    await h.signIn(id);
    h.resource.state.mode = 'unauthorized';
    const expired = await h.run(id);
    expect(expired.statusCode).toBe(401);
    expect(authError(expired)).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'expired' });
    h.resource.state.mode = 'insufficient_scope';
    const scope = await h.run(id);
    expect(scope.statusCode).toBe(403);
    expect(authError(scope)).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'insufficient_scope', scope: 'write' });
  });

  it('refreshes shortly before expiry and keeps the rotated refresh token', async () => {
    h.as.opts.expiresIn = 120;
    h.as.opts.expectResource = 'https://api.example/';
    const { id } = await h.createSource({ oauth: { resource: 'https://api.example/' } });
    await h.signIn(id);
    await h.run(id);
    const first = h.resource.state.seen[0];
    expect(h.as.tokenCalls).toHaveLength(1);
    h.clock.t += 61_000; // 59 s left: inside the refresh margin
    expect((await h.run(id)).statusCode).toBe(200);
    expect(h.as.tokenCalls).toHaveLength(2);
    const refresh = h.as.tokenCalls[1].params;
    expect(refresh.get('grant_type')).toBe('refresh_token');
    expect(refresh.get('resource')).toBe('https://api.example/');
    expect(h.resource.state.seen[1]).not.toBe(first);
    // The rotated token (the old one is now invalid at the server) is used for the next refresh.
    h.clock.t += 61_000;
    expect((await h.run(id)).statusCode).toBe(200);
    expect(h.as.tokenCalls).toHaveLength(3);
    expect(h.as.tokenCalls[2].params.get('refresh_token')).not.toBe(refresh.get('refresh_token'));
  });

  it('keeps the previous refresh token when the server does not rotate it', async () => {
    h.as.opts.expiresIn = 120;
    const { id } = await h.createSource();
    await h.signIn(id);
    h.clock.t += 61_000;
    await h.run(id);
    // The stub always issues a new refresh token, so check the not-rotated path with the pure helper too.
    expect(h.as.tokenCalls[1].params.get('refresh_token')).toBeTruthy();
    const { toStoredTokens } = await import('../sources/oauth/client');
    const kept = toStoredTokens({ access_token: 'a', token_type: 'bearer' }, 0, { refreshToken: 'old', scope: 's' });
    expect(kept).toMatchObject({ refreshToken: 'old', scope: 's', expiresAt: null });
  });

  it('runs one refresh at a time per source', async () => {
    h.as.opts.expiresIn = 120;
    const { id } = await h.createSource();
    await h.signIn(id);
    h.clock.t += 61_000;
    h.as.opts.tokenDelayMs = 150;
    const results = await Promise.all([h.run(id), h.run(id), h.run(id)]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    expect(h.as.tokenCalls.filter((c) => c.params.get('grant_type') === 'refresh_token')).toHaveLength(1);
  });

  it('answers reason expired when the refresh fails, and keeps the credential for a reconnect', async () => {
    h.as.opts.expiresIn = 120;
    const { id } = await h.createSource();
    await h.signIn(id);
    h.clock.t += 61_000;
    h.as.opts.refreshFails = true;
    const res = await h.run(id);
    expect(res.statusCode).toBe(401);
    expect(authError(res)).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'expired' });
    expect(h.resource.state.seen).toHaveLength(0);
    h.as.opts.refreshFails = false;
    await h.signIn(id);
    expect((await h.run(id)).statusCode).toBe(200);
  });
});
