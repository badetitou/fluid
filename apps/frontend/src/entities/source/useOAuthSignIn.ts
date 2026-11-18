import { useCallback, useEffect, useRef, useState } from 'react';
import { BFF_URL } from '../../runtime-config';
import { bffOrigin, oauthStartUrl, readOAuthMessage, type SignInStatus } from './oauth';

/** A popup closed this long without a message counts as abandoned (the message may still be on its way). */
const CLOSED_GRACE_MS = 800;
const POLL_MS = 400;

export interface OAuthSignIn {
  status: SignInStatus;
  /** Opens the BFF's sign-in in a popup; `scope` asks for more scopes (insufficient scope). */
  start: (scope?: string) => void;
}

/**
 * The popup sign-in of a source routed through the BFF. Resolves through the BFF's callback page
 * (a message from the BFF's origin, for this source); a blocked or closed popup is a status.
 * `onSignedIn` runs once the sign-in succeeded.
 */
export function useOAuthSignIn(sourceId: string | undefined, onSignedIn: () => void): OAuthSignIn {
  const [status, setStatus] = useState<SignInStatus>('idle');
  const cleanup = useRef<() => void>(() => undefined);
  const done = useRef(onSignedIn);
  done.current = onSignedIn;

  const start = useCallback(
    (scope?: string) => {
      if (!sourceId) return;
      cleanup.current();
      const popup = window.open(oauthStartUrl(BFF_URL, sourceId, window.location.origin, scope), 'fluid-oauth', 'popup,width=520,height=720');
      if (!popup) return setStatus('blocked');
      setStatus('waiting');

      const expected = bffOrigin(BFF_URL, window.location.origin);
      let timer: ReturnType<typeof setInterval> | undefined;
      let grace: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        clearInterval(timer);
        clearTimeout(grace);
        window.removeEventListener('message', onMessage);
        cleanup.current = () => undefined;
      };
      function onMessage(event: MessageEvent) {
        const result = readOAuthMessage(event, expected, sourceId as string);
        if (!result) return;
        stop();
        setStatus(result.ok ? 'idle' : 'failed');
        if (result.ok) done.current();
      }
      window.addEventListener('message', onMessage);
      timer = setInterval(() => {
        if (!popup.closed || grace) return;
        grace = setTimeout(() => {
          stop();
          setStatus('closed');
        }, CLOSED_GRACE_MS);
      }, POLL_MS);
      cleanup.current = stop;
    },
    [sourceId],
  );

  useEffect(() => () => cleanup.current(), []);

  return { status, start };
}
