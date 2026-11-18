import { useCallback } from 'react';
import { useAuthRequired } from '../authRequired';
import { browserAuthKey, settingsFingerprint, tokenUsable, type BrowserOAuthSettings, type MemoryToken } from './model';
import { useBrowserOAuthSettings, useBrowserTokens } from './store';

export interface BrowserOAuth {
  settings: BrowserOAuthSettings | undefined;
  token: MemoryToken | undefined;
  /** The token applies to the settings and has not expired. */
  usable: boolean;
  /** Keeps the settings; different ones forget the token (it was obtained with the old ones). */
  save: (settings: BrowserOAuthSettings) => void;
  /** Forgets the settings and the token: the source is queried without credentials again. */
  remove: () => void;
  /** Forgets the token only. */
  signOut: () => void;
}

/** The browser-only OAuth of a source (no BFF): its settings, kept per browser, and its in-memory token. */
export function useBrowserOAuth(sourceUrl: string | undefined): BrowserOAuth {
  const settings = useBrowserOAuthSettings((s) => (sourceUrl ? s.byUrl[sourceUrl] : undefined));
  const token = useBrowserTokens((s) => (sourceUrl ? s.byUrl[sourceUrl] : undefined));

  const forgetToken = useCallback(() => {
    if (!sourceUrl) return;
    useBrowserTokens.getState().set(sourceUrl, undefined);
    // Whatever was cached came with the old credential: the queries run anew.
    useAuthRequired.getState().reconnected(browserAuthKey(sourceUrl));
  }, [sourceUrl]);

  const save = useCallback(
    (next: BrowserOAuthSettings) => {
      if (!sourceUrl) return;
      const before = useBrowserOAuthSettings.getState().byUrl[sourceUrl];
      useBrowserOAuthSettings.getState().set(sourceUrl, next);
      if (!before || settingsFingerprint(before) !== settingsFingerprint(next)) forgetToken();
    },
    [sourceUrl, forgetToken],
  );

  const remove = useCallback(() => {
    if (!sourceUrl) return;
    useBrowserOAuthSettings.getState().set(sourceUrl, undefined);
    forgetToken();
  }, [sourceUrl, forgetToken]);

  return {
    settings,
    token,
    usable: !!settings && tokenUsable(token, settings, Date.now()),
    save,
    remove,
    signOut: forgetToken,
  };
}
