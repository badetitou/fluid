import { processRefreshTokenResponse, refreshTokenGrantRequest } from 'oauth4webapi';
import { SecretKeyError, decryptSecret, encryptSecret, type KeyProvider } from '../crypto';
import { clientFor, requestOptions, toStoredTokens, type OAuthSource } from './client';
import type { CredentialRepository } from './credentials';
import type { AuthServerInfo } from './discovery';
import { configFingerprint, type CredentialRecord } from './model';
import type { SafeFetch } from './safe-fetch';

/** Refresh when the access token expires within this window. */
export const REFRESH_MARGIN_MS = 60_000;

export type TokenResult = { ok: true; token: string } | { ok: false; reason: 'signin' | 'expired' };

export interface TokenManager {
  /** A usable access token for the source, refreshed first when it is about to expire. */
  accessToken(source: OAuthSource): Promise<TokenResult>;
}

export interface TokenDeps {
  creds: CredentialRepository;
  key: KeyProvider;
  discover: (issuer: string) => Promise<AuthServerInfo>;
  fetchOut: SafeFetch;
  loadSource: (id: string) => Promise<OAuthSource | null>;
  now?: () => number;
}

export function createTokenManager(deps: TokenDeps): TokenManager {
  const { creds, key, discover, fetchOut, loadSource, now = Date.now } = deps;
  // One read -> refresh -> save at a time per source: concurrent callers share the same promise,
  // so a rotating refresh token is never spent twice.
  const inflight = new Map<string, Promise<TokenResult>>();

  /** Skips the save when the source was reconfigured or the user signed out/in meanwhile. */
  async function stillCurrent(source: OAuthSource, cred: CredentialRecord): Promise<boolean> {
    const [fresh, current] = await Promise.all([loadSource(source.id), creds.get(source.id)]);
    return (
      !!fresh &&
      configFingerprint(fresh) === configFingerprint(source) &&
      !!current &&
      current.refreshToken === cred.refreshToken &&
      current.accessToken === cred.accessToken
    );
  }

  async function refresh(source: OAuthSource, cred: CredentialRecord): Promise<TokenResult> {
    if (!cred.refreshToken || !source.oauthIssuer || !source.oauthClientId) return { ok: false, reason: 'expired' };
    try {
      const info = await discover(source.oauthIssuer);
      const secret = source.oauthClientSecret ? decryptSecret(source.oauthClientSecret, key()) : null;
      const { client, auth } = clientFor(source.oauthClientId, secret, info);
      const opts = requestOptions(info.tokenEndpoint, fetchOut, source.oauthResource);
      const previous = decryptSecret(cred.refreshToken, key());
      const res = await refreshTokenGrantRequest(info.as, client, auth, previous, opts);
      const stored = toStoredTokens(await processRefreshTokenResponse(info.as, client, res), now(), {
        refreshToken: previous,
        scope: cred.scope,
      });
      if (!(await stillCurrent(source, cred))) return { ok: false, reason: 'signin' };
      await creds.save({
        sourceId: source.id,
        accessToken: encryptSecret(stored.accessToken, key()),
        refreshToken: stored.refreshToken ? encryptSecret(stored.refreshToken, key()) : null,
        expiresAt: stored.expiresAt,
        scope: stored.scope,
      });
      return { ok: true, token: stored.accessToken };
    } catch (err) {
      if (err instanceof SecretKeyError) throw err;
      // Any other failure (revoked grant, server down): the user has to reconnect. The stored
      // credential is kept.
      return { ok: false, reason: 'expired' };
    }
  }

  async function read(source: OAuthSource): Promise<TokenResult> {
    const cred = await creds.get(source.id);
    if (!cred) return { ok: false, reason: 'signin' };
    if (!cred.expiresAt || cred.expiresAt.getTime() - now() > REFRESH_MARGIN_MS) {
      return { ok: true, token: decryptSecret(cred.accessToken, key()) };
    }
    return refresh(source, cred);
  }

  return {
    accessToken(source) {
      const running = inflight.get(source.id);
      if (running) return running;
      // The slot is taken before the credential is read, so the whole read -> refresh -> save is
      // one promise; a later caller reads the already refreshed credential.
      const run = read(source).finally(() => inflight.delete(source.id));
      inflight.set(source.id, run);
      return run;
    },
  };
}
