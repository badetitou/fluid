import { useCallback, useState } from 'react';
import { bffClient } from '../../bff/client';
import type { OAuthDiscovery } from '../../bff/sourcesApi';

export interface OAuthDiscoveryResult {
  busy: boolean;
  error: string | null;
  /** Asks the BFF what the source (and the issuer, if typed) says about its OAuth; `null` when nothing was found. */
  discover: (sourceUrl: string, issuer: string) => Promise<OAuthDiscovery | null>;
}

/** The "Discover" action of the OAuth settings. */
export function useOAuthDiscovery(): OAuthDiscoveryResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async (sourceUrl: string, issuer: string) => {
    setBusy(true);
    setError(null);
    try {
      const found = await bffClient.sources.discover({ url: sourceUrl, ...(issuer.trim() ? { issuer: issuer.trim() } : {}) });
      if (!found.suggestion.issuer) {
        setError('This source does not advertise OAuth: type the issuer of its authorization server and try again.');
        return null;
      }
      if (found.authorizationServer && !found.authorizationServer.supportsS256) {
        setError('The authorization server does not support PKCE (S256): fluid cannot sign in with it.');
      } else if (!found.authorizationServer) {
        setError('The issuer was found but its authorization server metadata could not be read.');
      }
      return found;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The BFF did not answer');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, discover };
}
