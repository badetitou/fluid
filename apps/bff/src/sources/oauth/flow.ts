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
import { binderMatches, hashBinder, newBinder } from './binder';
import { clientFor, requestOptions, toStoredTokens, type OAuthSource } from './client';
import type { CredentialRepository } from './credentials';
import type { AuthServerInfo } from './discovery';
import { configFingerprint, splitScopes } from './model';
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

export interface StartOptions {
  /** The BFF callback URL sent to the authorization server. */
  redirectUri: string;
  /** The fluid UI origin the callback page posts its message to. */
  uiOrigin: string;
  extraScopes?: string[];
}

export interface CallbackResult {
  sourceId: string | null;
  ok: boolean;
  /** The UI origin recorded at start; null when the state is unknown or not ours. */
  uiOrigin: string | null;
  /** The state matched a pending sign-in started by this browser (its binder cookie can be cleared). */
  bound: boolean;
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
    /** The authorization URL to send the browser to, and the binder to set as a cookie. */
    async start(source: OAuthSource, opts: StartOptions): Promise<{ url: string; binder: string; state: string }> {
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
      const binder = newBinder();
      const scopes = [...new Set([...splitScopes(source.oauthScopes), ...(opts.extraScopes ?? [])])];
      const url = new URL(info.authorizationEndpoint);
      const params: Record<string, string> = {
        response_type: 'code',
        client_id: source.oauthClientId,
        redirect_uri: opts.redirectUri,
        state,
        nonce,
        code_challenge: await calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        ...(scopes.length ? { scope: scopes.join(' ') } : {}),
        ...(source.oauthResource ? { resource: source.oauthResource } : {}),
      };
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      pending.add({
        state,
        verifier,
        nonce,
        sourceId: source.id,
        redirectUri: opts.redirectUri,
        uiOrigin: opts.uiOrigin,
        scopes,
        binderHash: hashBinder(binder),
        fingerprint: configFingerprint(source),
        generation: source.authGeneration,
        oidc: scopes.includes('openid'),
        createdAt: now(),
      });
      return { url: url.toString(), binder, state };
    },

    /** Checks state (single use) and binder, exchanges the code with the verifier, stores the tokens. */
    async complete(query: URLSearchParams, binder: string | null): Promise<CallbackResult> {
      const state = query.get('state');
      const entry = state ? pending.take(state) : null;
      if (!entry) return { sourceId: null, ok: false, uiOrigin: null, bound: false, failure: 'unknown_state' };
      if (!binderMatches(entry.binderHash, binder)) {
        return { sourceId: null, ok: false, uiOrigin: null, bound: false, failure: 'binder_mismatch' };
      }
      const base = { sourceId: entry.sourceId, uiOrigin: entry.uiOrigin, bound: true };
      const unchanged = (s: OAuthSource | null): s is OAuthSource => !!s && configFingerprint(s) === entry.fingerprint && s.authGeneration === entry.generation;
      try {
        const source = await loadSource(entry.sourceId);
        if (!source) return { ...base, ok: false, failure: 'source_gone' };
        if (!unchanged(source) || !source.oauthIssuer || !source.oauthClientId) {
          return { ...base, ok: false, failure: 'config_changed' };
        }
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
        // The exchange takes time: the write is refused if the source was signed out,
        // reconfigured or deleted meanwhile (generation bumped), in the same transaction.
        const saved = await creds.saveIf(
          {
            sourceId: source.id,
            accessToken: encryptSecret(tokens.accessToken, key()),
            refreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken, key()) : null,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope ?? (entry.scopes.join(' ') || null),
          },
          { generation: entry.generation },
        );
        if (!saved) return { ...base, ok: false, failure: 'config_changed' };
        return { ...base, ok: true };
      } catch (err) {
        return { ...base, ok: false, failure: failureOf(err) };
      }
    },
  };
}
export type OAuthFlow = ReturnType<typeof createOAuthFlow>;
