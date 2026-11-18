import { processRefreshTokenResponse, refreshTokenGrantRequest } from 'oauth4webapi';
import { SecretKeyError, decryptSecret, encryptSecret, type KeyProvider } from '../crypto';
import { clientFor, requestOptions, toStoredTokens, type OAuthSource } from './client';
import type { CredentialRepository } from './credentials';
import type { AuthServerInfo } from './discovery';
import type { CredentialRecord } from './model';
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
  now?: () => number;
}

export function createTokenManager(deps: TokenDeps): TokenManager {
  const { creds, key, discover, fetchOut, now = Date.now } = deps;
  // One refresh at a time per source: concurrent callers share the same promise, so a rotating
  // refresh token is never spent twice.
  const inflight = new Map<string, Promise<TokenResult>>();

  async function refresh(source: OAuthSource, cred: CredentialRecord): Promise<TokenResult> {
    if (!cred.refreshToken || !source.oauthIssuer || !source.oauthClientId) return { ok: false, reason: 'expired' };
    try {
      const info = await discover(source.oauthIssuer);
      const secret = source.oauthClientSecret ? decryptSecret(source.oauthClientSecret, key()) : null;
      const { client, auth } = clientFor(source.oauthClientId, secret, info);
      const opts = requestOptions(info.tokenEndpoint, fetchOut, source.oauthResource);
      const res = await refreshTokenGrantRequest(info.as, client, auth, decryptSecret(cred.refreshToken, key()), opts);
      const stored = toStoredTokens(await processRefreshTokenResponse(info.as, client, res), now(), {
        refreshToken: decryptSecret(cred.refreshToken, key()),
        scope: cred.scope,
      });
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
      // Any other failure (revoked grant, server down): the user has to reconnect.
      return { ok: false, reason: 'expired' };
    }
  }

  return {
    async accessToken(source) {
      const pending = inflight.get(source.id);
      if (pending) return pending;
      const cred = await creds.get(source.id);
      if (!cred) return { ok: false, reason: 'signin' };
      if (!cred.expiresAt || cred.expiresAt.getTime() - now() > REFRESH_MARGIN_MS) {
        return { ok: true, token: decryptSecret(cred.accessToken, key()) };
      }
      const racing = inflight.get(source.id);
      if (racing) return racing;
      const run = refresh(source, cred).finally(() => inflight.delete(source.id));
      inflight.set(source.id, run);
      return run;
    },
  };
}
