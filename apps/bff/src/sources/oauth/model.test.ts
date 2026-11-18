import { describe, expect, it } from 'vitest';
import { callbackPage } from './callback-page';
import { authRequiredResult, configFingerprint, callbackUri, joinScopes, publicOrigin, splitScopes, toPublicOAuth } from './model';

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

describe('config fingerprint', () => {
  it('binds a fingerprint to issuer, client, secret, scopes, resource and url origin', () => {
    const base = { url: 'https://a.test/g', oauthIssuer: 'https://i', oauthClientId: 'c', oauthClientSecret: 's', oauthScopes: 'a', oauthResource: null };
    const fp = configFingerprint(base);
    expect(configFingerprint({ ...base, url: 'https://a.test/other' })).toBe(fp);
    for (const change of [
      { url: 'https://b.test/g' },
      { oauthIssuer: 'https://j' },
      { oauthClientId: 'd' },
      { oauthClientSecret: 't' },
      { oauthScopes: 'a b' },
      { oauthResource: 'https://r' },
    ]) {
      expect(configFingerprint({ ...base, ...change })).not.toBe(fp);
    }
  });
});
