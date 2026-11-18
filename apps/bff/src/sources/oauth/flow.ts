import {
  authorizationCodeGrantRequest,
  calculatePKCECodeChallenge,
  generateRandomCodeVerifier,
  generateRandomNonce,
  generateRandomState,
  processAuthorizationCodeResponse,
  validateAuthResponse,
} from 'oauth4webapi';
import { decryptSecret, encryptSecret, type KeyProvider } from '../crypto';
import { clientFor, requestOptions, toStoredTokens, type OAuthSource } from './client';
import type { CredentialRepository } from './credentials';
import type { AuthServerInfo } from './discovery';
import { splitScopes } from './model';
import type { PendingStore } from './pkce-pending';
import type { SafeFetch } from './safe-fetch';

// Authorization code + PKCE: building the authorization request, then finishing it at the callback.

export class FlowError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface FlowDeps {
  creds: CredentialRepository;
  key: KeyProvider;
  discover: (issuer: string) => Promise<AuthServerInfo>;
  fetchOut: SafeFetch;
  pending: PendingStore;
  loadSource: (id: string) => Promise<OAuthSource | null>;
  now?: () => number;
}

export interface CallbackResult {
  sourceId: string | null;
  ok: boolean;
  /** The redirect URI used at start (its origin is the fluid origin); null for an unknown state. */
  redirectUri: string | null;
  /** A short, safe code for the logs. Never a token, code or server text. */
  failure?: string;
}

const safeCode = (v: unknown) => (typeof v === 'string' && /^[a-z_]{1,40}$/.test(v) ? v : 'error');
const failureOf = (err: unknown): string => {
  const e = err as { error?: unknown; name?: unknown };
  return e.error ? `oauth:${safeCode(e.error)}` : typeof e.name === 'string' ? e.name.slice(0, 60) : 'error';
};

export function createOAuthFlow(deps: FlowDeps) {
  const { creds, key, discover, fetchOut, pending, loadSource, now = Date.now } = deps;

  return {
    /** The authorization endpoint URL to send the browser to. */
    async start(source: OAuthSource, redirectUri: string, extraScopes: string[] = []): Promise<string> {
      if (source.authKind !== 'oauth' || !source.oauthIssuer || !source.oauthClientId) {
        throw new FlowError(400, 'This source is not configured for OAuth');
      }
      let info: AuthServerInfo;
      try {
        info = await discover(source.oauthIssuer);
      } catch {
        throw new FlowError(502, 'Authorization server metadata could not be discovered');
      }
      if (!info.s256) throw new FlowError(400, 'The authorization server does not support PKCE S256');
      const verifier = generateRandomCodeVerifier();
      const state = generateRandomState();
      const nonce = generateRandomNonce();
      const scopes = [...new Set([...splitScopes(source.oauthScopes), ...extraScopes])];
      const url = new URL(info.authorizationEndpoint);
      const params: Record<string, string> = {
        response_type: 'code',
        client_id: source.oauthClientId,
        redirect_uri: redirectUri,
        state,
        nonce,
        code_challenge: await calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        ...(scopes.length ? { scope: scopes.join(' ') } : {}),
        ...(source.oauthResource ? { resource: source.oauthResource } : {}),
      };
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      pending.add({ state, verifier, nonce, sourceId: source.id, redirectUri, oidc: scopes.includes('openid'), createdAt: now() });
      return url.toString();
    },

    /** Checks state (single use), exchanges the code with the verifier, stores the tokens. */
    async complete(query: URLSearchParams): Promise<CallbackResult> {
      const state = query.get('state');
      const entry = state ? pending.take(state) : null;
      if (!entry) return { sourceId: null, ok: false, redirectUri: null, failure: 'unknown_state' };
      const base = { sourceId: entry.sourceId, redirectUri: entry.redirectUri };
      try {
        const source = await loadSource(entry.sourceId);
        if (!source?.oauthIssuer || !source.oauthClientId) return { ...base, ok: false, failure: 'source_gone' };
        const info = await discover(source.oauthIssuer);
        const secret = source.oauthClientSecret ? decryptSecret(source.oauthClientSecret, key()) : null;
        const { client, auth } = clientFor(source.oauthClientId, secret, info);
        const params = validateAuthResponse(info.as, client, query, entry.state);
        const opts = requestOptions(info.tokenEndpoint, fetchOut, source.oauthResource);
        const res = await authorizationCodeGrantRequest(info.as, client, auth, params, entry.redirectUri, entry.verifier, opts);
        const tokens = toStoredTokens(
          // With `openid` the server must return an ID token carrying our nonce; plain OAuth has none.
          await processAuthorizationCodeResponse(info.as, client, res, entry.oidc ? { expectedNonce: entry.nonce } : {}),
          now(),
        );
        await creds.save({
          sourceId: source.id,
          accessToken: encryptSecret(tokens.accessToken, key()),
          refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken, key()) : null,
          expiresAt: tokens.expiresAt,
          scope: tokens.scope ?? source.oauthScopes,
        });
        return { ...base, ok: true };
      } catch (err) {
        return { ...base, ok: false, failure: failureOf(err) };
      }
    },
  };
}
export type OAuthFlow = ReturnType<typeof createOAuthFlow>;
