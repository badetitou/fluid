import { describe, expect, it } from 'vitest';
import { applyDiscovery, oauthFormOf, splitScopes } from './oauthForm';

describe('applyDiscovery', () => {
  const form = { issuer: 'typed', clientId: 'c', clientSecret: 's', scopes: 'a', resource: 'r' };

  it('fills issuer, scopes and resource, keeping the client id and the typed secret', () => {
    const out = applyDiscovery(form, {
      suggestion: { issuer: 'https://as', scopes: ['read', 'write'], resource: 'https://api' },
      authorizationServer: { supportsS256: true },
    });
    expect(out).toEqual({ issuer: 'https://as', clientId: 'c', clientSecret: 's', scopes: 'read write', resource: 'https://api' });
  });

  it('leaves what the source did not suggest', () => {
    const out = applyDiscovery(form, { suggestion: { issuer: null, scopes: [], resource: null }, authorizationServer: null });
    expect(out).toEqual(form);
  });
});

describe('oauthFormOf / splitScopes', () => {
  it('is empty without config nor suggestion', () => {
    expect(oauthFormOf(null)).toEqual({ issuer: '', clientId: '', clientSecret: '', scopes: '', resource: '' });
  });

  it('splits scopes on any whitespace', () => {
    expect(splitScopes(' a  b\tc\n')).toEqual(['a', 'b', 'c']);
    expect(splitScopes('')).toEqual([]);
  });
});
