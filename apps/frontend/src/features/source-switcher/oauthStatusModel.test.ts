import { describe, expect, it } from 'vitest';
import { signInSummary } from './oauthStatusModel';

const base = {
  issuer: 'https://as',
  clientId: 'c',
  hasClientSecret: false,
  scopes: [],
  resource: null,
  signedIn: true,
  expiresAt: null,
  grantedScopes: [],
};

describe('signInSummary', () => {
  it('says when the user is not signed in', () => {
    expect(signInSummary({ ...base, signedIn: false })).toBe('Not signed in');
  });

  it('says signed in, with the expiry when there is a valid one', () => {
    expect(signInSummary(base)).toBe('Signed in');
    expect(signInSummary({ ...base, expiresAt: 'garbage' })).toBe('Signed in');
    expect(signInSummary({ ...base, expiresAt: '2030-01-02T03:04:05.000Z' }, 'en-US')).toMatch(/^Signed in, access token expires .*2030/);
  });
});
