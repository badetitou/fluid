import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
// The flow itself (PKCE, discovery, token exchange) is tested in flow.test.ts, under Node: jsdom's
// typed arrays come from another realm than Node's WebCrypto. Here, a stand-in with the same checks.
vi.mock('./flow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./flow')>();
  return {
    ...actual,
    startSignIn: vi.fn(async (sourceUrl: string, settings: BrowserOAuthSettings, server: AuthServer, redirectUri: string, now: number) => {
      const state = `state-${Math.random()}`;
      const url = `${server.authorizationEndpoint}?state=${state}`;
      return { url, pending: { state, verifier: 'v', nonce: 'n', sourceUrl, settings, scopes: settings.scopes, redirectUri, server, createdAt: now } };
    }),
    finishSignIn: vi.fn(async (pending: PendingSignIn, callback: URL) => {
      if (callback.searchParams.get('state') !== pending.state || !callback.searchParams.get('code')) throw new Error('bad callback');
      return { accessToken: 'AT', expiresAt: null, scope: 'read', fingerprint: settingsFingerprint(pending.settings) };
    }),
  };
});

import type { AuthServer, PendingSignIn } from './flow';
import { useAuthRequired } from '../authRequired';
import { browserAuthKey, settingsFingerprint, type BrowserOAuthSettings } from './model';
import { useBrowserOAuthSettings, useBrowserTokens } from './store';
import { pageRedirectUri, useBrowserSignIn } from './useBrowserSignIn';

const SOURCE = 'https://api.test/graphql';
const ISSUER = 'https://as.test';
const settings: BrowserOAuthSettings = { issuer: ISSUER, clientId: 'fluid', scopes: ['read'] };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let popup: { closed: boolean; close: () => void; location: { href: string } };

beforeEach(() => {
  useBrowserOAuthSettings.setState({ byUrl: { [SOURCE]: settings } });
  useBrowserTokens.setState({ byUrl: {} });
  useAuthRequired.setState({ required: {}, failing: {}, epoch: {} });
  popup = { closed: false, close: vi.fn(() => (popup.closed = true)), location: { href: '' } };
  vi.spyOn(window, 'open').mockImplementation(() => popup as unknown as Window);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === `${ISSUER}/.well-known/oauth-authorization-server`) {
        return json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/authorize`,
          token_endpoint: `${ISSUER}/token`,
          code_challenge_methods_supported: ['S256'],
        });
      }
      if (url === `${ISSUER}/token`) return json({ access_token: 'AT', token_type: 'bearer', expires_in: 3600 });
      return new Response('', { status: 404 });
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** What the callback page posts once the authorization server redirected to it. */
const callback = (query: string, origin = window.location.origin) =>
  new MessageEvent('message', { origin, data: { type: 'fluid-oauth-browser', url: `${pageRedirectUri()}?${query}` } });

async function startedSignIn() {
  const hook = renderHook(() => useBrowserSignIn(SOURCE));
  act(() => hook.result.current.start());
  await waitFor(() => expect(popup.location.href).toContain(`${ISSUER}/authorize?`));
  const state = new URL(popup.location.href).searchParams.get('state') as string;
  return { hook, state };
}

describe('useBrowserSignIn', () => {
  it('opens the authorization server, then keeps the token in memory once the callback comes back', async () => {
    const { hook, state } = await startedSignIn();
    expect(hook.result.current.status).toBe('waiting');
    act(() => void window.dispatchEvent(callback(`code=C&state=${state}`)));
    await waitFor(() => expect(hook.result.current.status).toBe('idle'));
    expect(useBrowserTokens.getState().byUrl[SOURCE]?.accessToken).toBe('AT');
    expect(useAuthRequired.getState().epoch[browserAuthKey(SOURCE)]).toBe(1);
    expect(JSON.stringify(localStorage)).not.toContain('AT');
  });

  it('ignores a callback for another sign-in, or from another origin', async () => {
    const { hook, state } = await startedSignIn();
    act(() => void window.dispatchEvent(callback('code=C&state=forged')));
    act(() => void window.dispatchEvent(callback(`code=C&state=${state}`, 'https://evil.test')));
    expect(hook.result.current.status).toBe('waiting');
    expect(useBrowserTokens.getState().byUrl[SOURCE]).toBeUndefined();
  });

  it('fails when the authorization server answers with an error', async () => {
    const { hook, state } = await startedSignIn();
    act(() => void window.dispatchEvent(callback(`error=access_denied&state=${state}`)));
    await waitFor(() => expect(hook.result.current.status).toBe('failed'));
    expect(useBrowserTokens.getState().byUrl[SOURCE]).toBeUndefined();
  });

  it('says when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const hook = renderHook(() => useBrowserSignIn(SOURCE));
    act(() => hook.result.current.start());
    expect(hook.result.current.status).toBe('blocked');
  });

  it('closes the popup and fails when discovery fails', async () => {
    useBrowserOAuthSettings.setState({ byUrl: { [SOURCE]: { ...settings, issuer: 'https://nowhere.test' } } });
    const hook = renderHook(() => useBrowserSignIn(SOURCE));
    act(() => hook.result.current.start());
    await waitFor(() => expect(hook.result.current.status).toBe('failed'));
    expect(popup.close).toHaveBeenCalled();
    expect(hook.result.current.error).toMatch(/metadata/);
  });
});
