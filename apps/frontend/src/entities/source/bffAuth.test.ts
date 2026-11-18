import { describe, expect, it } from 'vitest';
import type { BffSourceConfig } from '../../bff/sourcesApi';
import { authFormError, authFormKey, authFormOf, authPatch, bffSourceName, createAuth } from './bffAuth';
import { oauthFormOf } from './oauthForm';

const config = (over: Partial<BffSourceConfig>): BffSourceConfig => ({
  id: 's1',
  name: 'S',
  url: 'https://api.example.com/graphql',
  authKind: 'none',
  headerName: null,
  hasSecret: false,
  ...over,
});
const noOAuth = oauthFormOf(null);

describe('auth form', () => {
  it('starts from the stored config without any secret, header defaulting to Authorization', () => {
    expect(authFormOf(null)).toEqual({ authKind: 'none', headerName: 'Authorization', secret: '', oauth: noOAuth });
    const form = authFormOf(config({ authKind: 'header', headerName: 'X-Api-Key' }));
    expect(form).toMatchObject({ authKind: 'header', headerName: 'X-Api-Key', secret: '' });
  });

  it('starts from the stored OAuth settings, never with a secret', () => {
    const form = authFormOf(
      config({
        authKind: 'oauth',
        oauth: {
          issuer: 'https://as.example.com',
          clientId: 'c',
          hasClientSecret: true,
          scopes: ['read', 'write'],
          resource: 'https://api.example.com',
          signedIn: false,
          expiresAt: null,
          grantedScopes: [],
        },
      }),
    );
    expect(form.authKind).toBe('oauth');
    expect(form.oauth).toEqual({
      issuer: 'https://as.example.com',
      clientId: 'c',
      clientSecret: '',
      scopes: 'read write',
      resource: 'https://api.example.com',
    });
  });

  it('creates a config with the OAuth settings the plugin ships (no secret), else with no auth', () => {
    const suggested = { kind: 'oauth' as const, issuer: 'https://as.example.com', clientId: 'fluid', scopes: ['read'] };
    expect(createAuth(suggested)).toEqual({
      authKind: 'oauth',
      oauth: { issuer: 'https://as.example.com', clientId: 'fluid', scopes: ['read'] },
    });
    expect(createAuth({ ...suggested, scopes: undefined, resource: 'https://api' }).oauth).toEqual({
      issuer: 'https://as.example.com',
      clientId: 'fluid',
      scopes: [],
      resource: 'https://api',
    });
    expect(createAuth(undefined)).toEqual({ authKind: 'none' });
  });

  it('removes header and secret when auth is none', () => {
    expect(authPatch({ ...authFormOf(null), authKind: 'none', headerName: 'X', secret: 'typed' })).toEqual({
      authKind: 'none',
      headerName: null,
      secret: null,
    });
  });

  it('sends the secret only when typed (else the stored one is kept)', () => {
    const base = authFormOf(null);
    expect(authPatch({ ...base, authKind: 'header', headerName: ' X-Key ', secret: ' tok ' })).toEqual({
      authKind: 'header',
      headerName: 'X-Key',
      secret: 'tok',
    });
    const kept = authPatch({ ...base, authKind: 'header', headerName: '', secret: '' });
    expect(kept).toEqual({ authKind: 'header', headerName: 'Authorization' });
    expect('secret' in kept).toBe(false);
  });

  it('sends the OAuth settings, the client secret only when typed', () => {
    const form = {
      ...authFormOf(null),
      authKind: 'oauth' as const,
      oauth: { issuer: ' https://as.example.com ', clientId: ' c ', clientSecret: '', scopes: 'read  write', resource: '' },
    };
    const kept = authPatch(form);
    expect(kept).toEqual({
      authKind: 'oauth',
      oauth: { issuer: 'https://as.example.com', clientId: 'c', scopes: ['read', 'write'], resource: null },
    });
    expect('clientSecret' in (kept.oauth ?? {})).toBe(false);
    expect(authPatch({ ...form, oauth: { ...form.oauth, clientSecret: ' s3cret ' } }).oauth?.clientSecret).toBe('s3cret');
  });

  it('refuses an OAuth form without issuer or client id', () => {
    const form = { ...authFormOf(null), authKind: 'oauth' as const };
    expect(authFormError(form)).toMatch(/issuer/);
    expect(authFormError({ ...form, oauth: { ...form.oauth, issuer: 'https://as' } })).toMatch(/client id/);
    expect(authFormError({ ...form, oauth: { ...form.oauth, issuer: 'https://as', clientId: 'c' } })).toBeNull();
    expect(authFormError(authFormOf(null))).toBeNull();
  });

  it('restarts the form when the stored settings change, not when the sign-in state does', () => {
    const oauth = (signedIn: boolean) =>
      config({
        authKind: 'oauth',
        oauth: { issuer: 'i', clientId: 'c', hasClientSecret: false, scopes: [], resource: null, signedIn, expiresAt: null, grantedScopes: [] },
      });
    expect(authFormKey(oauth(false))).toBe(authFormKey(oauth(true)));
    expect(authFormKey(oauth(false))).not.toBe(authFormKey(config({})));
  });
});

describe('bffSourceName', () => {
  it('prefers the given name, then the host, then the raw URL', () => {
    expect(bffSourceName('https://api.github.com/graphql', ' GitHub ')).toBe('GitHub');
    expect(bffSourceName('https://api.github.com/graphql')).toBe('api.github.com');
    expect(bffSourceName('not a url')).toBe('not a url');
  });
});
