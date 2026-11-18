import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthRequired } from '../authRequired';
import type { SignInStatus } from '../oauth';
import { createPendingSignIns, discoverAuthServer, finishSignIn, startSignIn } from './flow';
import { browserAuthKey, browserRedirectUri, CALLBACK_MESSAGE_TYPE, readCallbackMessage } from './model';
import { useBrowserOAuthSettings, useBrowserTokens } from './store';

const CLOSED_GRACE_MS = 5000;
const POLL_MS = 400;

// Shared by every hook of this page: the verifier never leaves this module, and dies with the page.
const pending = createPendingSignIns();
const browserFetch = (url: string, init?: RequestInit) => fetch(url, init);
const message = (e: unknown) => (e instanceof Error && e.message ? e.message : 'The sign-in failed.');

/** The redirect URI of this deployment, to register with the authorization server. */
export const pageRedirectUri = (): string => browserRedirectUri(window.location.origin, import.meta.env.BASE_URL);

export interface BrowserSignIn {
  status: SignInStatus;
  /** Why the last sign-in failed, when there is more to say than the status. */
  error: string | null;
  /** Opens the authorization server in a popup; `scope` asks for more scopes. */
  start: (scope?: string) => void;
}

/**
 * The popup sign-in of a source from the page itself (no BFF). The callback page reports the
 * redirect through a BroadcastChannel and `window.opener`; only the sign-in this hook started
 * (its `state`) is finished here. Switching to another source drops a sign-in in progress.
 */
export function useBrowserSignIn(sourceUrl: string | undefined): BrowserSignIn {
  const [status, setStatus] = useState<SignInStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const cleanup = useRef<() => void>(() => undefined);

  const start = useCallback(
    (scope?: string) => {
      const settings = sourceUrl ? useBrowserOAuthSettings.getState().byUrl[sourceUrl] : undefined;
      if (!sourceUrl || !settings) return;
      cleanup.current();
      // Opened at once (a popup opened after an await would be blocked), sent to the server once known.
      const popup = window.open('', 'fluid-oauth', 'popup,width=520,height=720');
      if (!popup) return setStatus('blocked');
      setStatus('waiting');
      setError(null);

      const redirectUri = pageRedirectUri();
      let expectedState: string | null = null;
      let active = true;
      let timer: ReturnType<typeof setInterval> | undefined;
      let grace: ReturnType<typeof setTimeout> | undefined;
      const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CALLBACK_MESSAGE_TYPE);
      const stop = () => {
        active = false;
        clearInterval(timer);
        clearTimeout(grace);
        window.removeEventListener('message', onMessage);
        channel?.close();
        cleanup.current = () => undefined;
      };
      const fail = (e: unknown) => {
        if (!active) return;
        stop();
        setStatus('failed');
        setError(message(e));
      };
      async function onMessage(event: MessageEvent) {
        const callback = readCallbackMessage(event, window.location.origin, redirectUri);
        const state = callback?.searchParams.get('state') ?? null;
        if (!active || !callback || !expectedState || state !== expectedState) return;
        const signIn = pending.take(state, Date.now());
        stop();
        if (!signIn) return fail(new Error('The sign-in took too long: try again.'));
        try {
          const token = await finishSignIn(signIn, callback, browserFetch, Date.now());
          useBrowserTokens.getState().set(signIn.sourceUrl, token);
          useAuthRequired.getState().reconnected(browserAuthKey(signIn.sourceUrl));
          setStatus('idle');
        } catch (e) {
          setStatus('failed');
          setError(message(e));
        }
      }
      window.addEventListener('message', onMessage);
      channel?.addEventListener('message', onMessage);
      timer = setInterval(() => {
        if (!popup.closed || grace) return;
        grace = setTimeout(() => {
          if (!active) return;
          stop();
          setStatus('closed');
        }, CLOSED_GRACE_MS);
      }, POLL_MS);
      cleanup.current = () => {
        stop();
        pending.dropFor(sourceUrl);
        if (!popup.closed) popup.close();
      };

      discoverAuthServer(settings.issuer, browserFetch)
        .then((server) => startSignIn(sourceUrl, settings, server, redirectUri, Date.now(), scope))
        .then(({ url, pending: signIn }) => {
          if (!active) return;
          pending.dropFor(sourceUrl);
          pending.add(signIn);
          expectedState = signIn.state;
          popup.location.href = url;
        })
        .catch((e) => {
          if (!popup.closed) popup.close();
          fail(e);
        });
    },
    [sourceUrl],
  );

  // A sign-in belongs to the source it started for: another source (or leaving) drops it.
  useEffect(
    () => () => {
      cleanup.current();
      setStatus('idle');
      setError(null);
    },
    [sourceUrl],
  );

  return { status, error, start };
}
