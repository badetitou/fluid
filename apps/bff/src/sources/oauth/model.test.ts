import { describe, expect, it } from 'vitest';
import { callbackPage } from './callback-page';
import { parseBearerChallenge } from './challenge';
import { metadataCandidates } from './discovery';
import { authRequiredResult, callbackUri, joinScopes, publicOrigin, splitScopes, toPublicOAuth } from './model';
import { createPendingStore } from './pkce-pending';

describe('bearer challenge', () => {
  it('reads resource_metadata, error and scope', () => {
    expect(
      parseBearerChallenge('Bearer resource_metadata="https://r.test/.well-known/oauth-protected-resource", scope="a b"'),
    ).toEqual({ resourceMetadata: 'https://r.test/.well-known/oauth-protected-resource', scope: 'a b' });
    expect(parseBearerChallenge('Bearer error="insufficient_scope", scope="write"')).toEqual({
      error: 'insufficient_scope',
      scope: 'write',
    });
    expect(parseBearerChallenge('Basic realm="x"')).toEqual({});
    expect(parseBearerChallenge(null)).toEqual({});
  });
});

describe('metadata candidates', () => {
  it('follows the MCP order, with path insertion for issuers that have a path', () => {
    expect(metadataCandidates('https://a.test')).toEqual([
      'https://a.test/.well-known/oauth-authorization-server',
      'https://a.test/.well-known/openid-configuration',
    ]);
    expect(metadataCandidates('https://a.test/t1/')).toEqual([
      'https://a.test/.well-known/oauth-authorization-server/t1',
      'https://a.test/.well-known/openid-configuration/t1',
      'https://a.test/t1/.well-known/openid-configuration',
    ]);
  });
});

describe('auth errors and public view', () => {
  it('builds typed GraphQL errors: 401 for signin/expired, 403 for insufficient_scope', () => {
    expect(authRequiredResult('signin').status).toBe(401);
    expect(authRequiredResult('expired').body.errors[0].extensions).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'expired' });
    const scope = authRequiredResult('insufficient_scope', 'write');
    expect(scope.status).toBe(403);
    expect(scope.body.errors[0].extensions).toEqual({ code: 'FLUID_AUTH_REQUIRED', reason: 'insufficient_scope', scope: 'write' });
  });

  it('never exposes the client secret or tokens', () => {
    const view = toPublicOAuth(
      { oauthIssuer: 'https://i', oauthClientId: 'c', oauthClientSecret: 'ENC-SECRET', oauthScopes: 'a b', oauthResource: null },
      { sourceId: 's', accessToken: 'ENC-AT', refreshToken: 'ENC-RT', expiresAt: new Date(0), scope: 'a' },
    );
    expect(JSON.stringify(view)).not.toMatch(/ENC-/);
    expect(view).toMatchObject({ hasClientSecret: true, signedIn: true, scopes: ['a', 'b'], grantedScopes: ['a'] });
  });

  it('handles scopes and the redirect URI', () => {
    expect(splitScopes(' a  b ')).toEqual(['a', 'b']);
    expect(joinScopes(['a', 'a', 'b'])).toBe('a b');
    expect(joinScopes([])).toBeNull();
    expect(publicOrigin('https://f.test/x/', { protocol: 'http', host: 'h:1' })).toBe('https://f.test');
    expect(publicOrigin(undefined, { protocol: 'http', host: 'h:1' })).toBe('http://h:1');
    expect(callbackUri('https://f.test')).toBe('https://f.test/api/oauth/callback');
  });
});

describe('callback page', () => {
  it('escapes script-breaking characters and posts to the given origin', () => {
    const html = callbackPage({ sourceId: '</script><b>', ok: false, origin: 'https://f.test' });
    expect(html).not.toContain('</script><b>');
    expect(html).toContain('postMessage(');
    expect(html).toContain('"https://f.test"');
    expect(html).toContain('window.close()');
  });
});

describe('pending sign-ins', () => {
  const entry = { state: 's', verifier: 'v', nonce: 'n', sourceId: 'x', redirectUri: 'r', oidc: false };
  it('is single use and expires after the TTL', () => {
    let t = 0;
    const store = createPendingStore(1000, () => t);
    store.add({ ...entry, createdAt: 0 });
    expect(store.take('s')?.verifier).toBe('v');
    expect(store.take('s')).toBeNull();
    store.add({ ...entry, createdAt: 0 });
    t = 1000;
    expect(store.take('s')).toBeNull();
  });
});
