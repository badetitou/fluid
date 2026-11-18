import { useCallback, useEffect, useRef, useState } from 'react';
import { BFF_URL } from '../../runtime-config';
import { bffOrigin, oauthStartUrl, readOAuthMessage, type SignInStatus } from './oauth';

/**
 * A popup seen closed without a message is only abandoned after this long: the message may still be
 * on its way, and a cross-origin-opener-policy page can make `closed` read true early.
 */
const CLOSED_GRACE_MS = 5000;
const POLL_MS = 400;

export interface OAuthSignIn {
  status: SignInStatus;
  /** Opens the BFF's sign-in in a popup; `scope` asks for more scopes (insufficient scope). */
  start: (scope?: string) => void;
}

/**
 * The popup sign-in of a source routed through the BFF. Resolves through the BFF's callback page
 * (a message from the popup, from the BFF's origin, for this source); a blocked or closed popup is a
 * status. `onSignedIn(sourceId)` runs once the sign-in succeeded, `onClosed(sourceId)` when the popup
 * went away without a message (the sign-in may still have worked: the caller can look again).
 * Switching to another source drops a sign-in in progress.
 */
export function useOAuthSignIn(
  sourceId: string | undefined,
  onSignedIn: (sourceId: string) => void,
  onClosed?: (sourceId: string) => void,
): OAuthSignIn {
  const [status, setStatus] = useState<SignInStatus>('idle');
  const cleanup = useRef<() => void>(() => undefined);
  const done = useRef({ onSignedIn, onClosed });
  done.current = { onSignedIn, onClosed };

  const start = useCallback(
    (scope?: string) => {
      if (!sourceId) return;
      cleanup.current();
      // Not `noopener`: the BFF's callback page reports back through `window.opener`. The popup only ever
      // shows the authorization server and the BFF, and the message is checked (window, origin, shape, source).
      const popup = window.open(
        oauthStartUrl(BFF_URL, sourceId, window.location.origin, scope),
        'fluid-oauth',
        'popup,width=520,height=720',
      );
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
        if (event.source !== popup) return;
        const result = readOAuthMessage(event, expected, sourceId as string);
        if (!result) return;
        stop();
        setStatus(result.ok ? 'idle' : 'failed');
        if (result.ok) done.current.onSignedIn(sourceId as string);
      }
      window.addEventListener('message', onMessage);
      timer = setInterval(() => {
        if (!popup.closed || grace) return;
        grace = setTimeout(() => {
          stop();
          setStatus('closed');
          done.current.onClosed?.(sourceId as string);
        }, CLOSED_GRACE_MS);
      }, POLL_MS);
      cleanup.current = () => {
        stop();
        if (!popup.closed) popup.close();
      };
    },
    [sourceId],
  );

  // A sign-in belongs to the source it started for: another source (or leaving) drops it.
  useEffect(
    () => () => {
      cleanup.current();
      setStatus('idle');
    },
    [sourceId],
  );

  return { status, start };
}
