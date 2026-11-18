import { describe, expect, it } from 'vitest';
import {
  browserFormOf,
  browserRedirectUri,
  browserSettingsOf,
  browserTokenSummary,
  parseBrowserOAuthSettings,
  readCallbackMessage,
  settingsFingerprint,
  toMemoryToken,
  tokenUsable,
  type BrowserOAuthSettings,
} from './model';

const settings: BrowserOAuthSettings = { issuer: 'https://as.test', clientId: 'fluid', scopes: ['read'] };
const redirect = 'https://fluid.test/app/oauth-callback.html';

describe('settings', () => {
  it('keeps only well-formed settings read back from the browser', () => {
    expect(
      parseBrowserOAuthSettings({
        'https://a.test/graphql': settings,
        'https://b.test/graphql': { issuer: 'javascript:alert(1)', clientId: 'x', scopes: [] },
        'https://c.test/graphql': { issuer: 'https://as.test?x=1', clientId: 'x', scopes: [] },
        'https://d.test/graphql': 'nope',
      }),
    ).toEqual({ 'https://a.test/graphql': settings });
    expect(parseBrowserOAuthSettings(null)).toEqual({});
  });

  it('builds settings from the form, or says what is missing', () => {
    expect(browserSettingsOf({ issuer: ' https://as.test ', clientId: ' fluid ', scopes: ' read  read write ', resource: '' })).toEqual({
      issuer: 'https://as.test',
      clientId: 'fluid',
      scopes: ['read', 'write'],
    });
    expect(browserSettingsOf({ issuer: '', clientId: 'c', scopes: '', resource: '' })).toEqual({ error: 'The issuer is required.' });
    expect(browserSettingsOf({ issuer: 'https://as.test', clientId: '', scopes: '', resource: '' })).toEqual({
      error: 'The client id is required.',
    });
    expect(browserSettingsOf({ issuer: 'https://as.test', clientId: 'c', scopes: '', resource: 'nope' })).toHaveProperty('error');
  });

  it('starts the form from the kept settings, else from the plugin', () => {
    expect(browserFormOf(settings).clientId).toBe('fluid');
    expect(browserFormOf(undefined, { kind: 'oauth', issuer: 'https://p.test', clientId: 'p', scopes: ['a', 'b'] })).toEqual({
      issuer: 'https://p.test',
      clientId: 'p',
      scopes: 'a b',
      resource: '',
    });
    expect(browserFormOf().issuer).toBe('');
  });

  it('fingerprints what a token was obtained with, whatever the scope order', () => {
    expect(settingsFingerprint({ ...settings, scopes: ['b', 'a'] })).toBe(settingsFingerprint({ ...settings, scopes: ['a', 'b'] }));
    expect(settingsFingerprint({ ...settings, clientId: 'other' })).not.toBe(settingsFingerprint(settings));
    expect(settingsFingerprint({ ...settings, resource: 'https://api.test' })).not.toBe(settingsFingerprint(settings));
  });
});

describe('callback', () => {
  it('puts the callback page next to the app', () => {
    expect(browserRedirectUri('https://fluid.test', '/app/')).toBe(redirect);
    expect(browserRedirectUri('https://fluid.test', '/app')).toBe(redirect);
    expect(browserRedirectUri('http://localhost:5173', '/')).toBe('http://localhost:5173/oauth-callback.html');
  });

  it('reads only the callback page message, from the page origin, for the redirect URI', () => {
    const data = { type: 'fluid-oauth-browser', url: `${redirect}?code=c&state=s` };
    expect(readCallbackMessage({ origin: 'https://fluid.test', data }, 'https://fluid.test', redirect)?.searchParams.get('code')).toBe('c');
    expect(readCallbackMessage({ origin: 'https://evil.test', data }, 'https://fluid.test', redirect)).toBeNull();
    expect(readCallbackMessage({ origin: 'https://fluid.test', data: { ...data, type: 'other' } }, 'https://fluid.test', redirect)).toBeNull();
    const elsewhere = { ...data, url: 'https://fluid.test/other.html?code=c&state=s' };
    expect(readCallbackMessage({ origin: 'https://fluid.test', data: elsewhere }, 'https://fluid.test', redirect)).toBeNull();
    expect(readCallbackMessage({ origin: 'https://fluid.test', data: { ...data, url: 'nope' } }, 'https://fluid.test', redirect)).toBeNull();
  });
});

describe('tokens', () => {
  const fp = settingsFingerprint(settings);

  it('keeps the access token, its expiry and scope, never a refresh token', () => {
    const token = toMemoryToken({ access_token: 'AT', token_type: 'Bearer', expires_in: 60, refresh_token: 'RT' }, 1000, fp, ['read']);
    expect(token).toEqual({ accessToken: 'AT', expiresAt: 61_000, scope: 'read', fingerprint: fp });
    expect(JSON.stringify(token)).not.toContain('RT');
    expect(() => toMemoryToken({ access_token: 'AT', token_type: 'DPoP' }, 0, fp, [])).toThrow();
    expect(() => toMemoryToken({ token_type: 'bearer' }, 0, fp, [])).toThrow();
  });

  it('uses a token only for its settings and before it expires', () => {
    const token = { accessToken: 'AT', expiresAt: 100_000, scope: null, fingerprint: fp };
    expect(tokenUsable(token, settings, 50_000)).toBe(true);
    expect(tokenUsable(token, settings, 95_000)).toBe(false);
    expect(tokenUsable({ ...token, expiresAt: null }, settings, 1e12)).toBe(true);
    expect(tokenUsable(token, { ...settings, clientId: 'other' }, 0)).toBe(false);
    expect(tokenUsable(undefined, settings, 0)).toBe(false);
  });

  it('summarizes the sign-in', () => {
    const token = { accessToken: 'AT', expiresAt: null, scope: null, fingerprint: fp };
    expect(browserTokenSummary(undefined, false)).toBe('Not signed in');
    expect(browserTokenSummary(token, false)).toBe('Sign-in expired');
    expect(browserTokenSummary(token, true)).toBe('Signed in in this tab');
  });
});
