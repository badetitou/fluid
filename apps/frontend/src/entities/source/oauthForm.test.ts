import { describe, expect, it } from 'vitest';
import { discoveryPatch, oauthFormOf, splitScopes } from './oauthForm';

describe('discoveryPatch', () => {
  it('holds only the discovered fields: issuer, scopes and resource', () => {
    const patch = discoveryPatch({
      suggestion: { issuer: 'https://as', scopes: ['read', 'write'], resource: 'https://api' },
      authorizationServer: { supportsS256: true },
    });
    expect(patch).toEqual({ issuer: 'https://as', scopes: 'read write', resource: 'https://api' });
  });

  it('leaves out what the source did not suggest', () => {
    const patch = discoveryPatch({ suggestion: { issuer: 'https://as', scopes: [], resource: null }, authorizationServer: null });
    expect(patch).toEqual({ issuer: 'https://as' });
  });
});

describe('oauthFormOf / splitScopes', () => {
  it('is empty without config', () => {
    expect(oauthFormOf(null)).toEqual({ issuer: '', clientId: '', clientSecret: '', scopes: '', resource: '' });
  });

  it('splits scopes on any whitespace', () => {
    expect(splitScopes(' a  b\tc\n')).toEqual(['a', 'b', 'c']);
    expect(splitScopes('')).toEqual([]);
  });
});
