import {
  allowInsecureRequests,
  authorizationCodeGrantRequest,
  calculatePKCECodeChallenge,
  customFetch,
  generateRandomCodeVerifier,
  generateRandomNonce,
  generateRandomState,
  None,
  processAuthorizationCodeResponse,
  processDiscoveryResponse,
  validateAuthResponse,
  type AuthorizationServer,
} from 'oauth4webapi';
import { authServerMetadataSchema, endpointsAllowed, metadataCandidates } from '@fluid/shared';
import { settingsFingerprint, toMemoryToken, type BrowserOAuthSettings, type MemoryToken } from './model';

// Authorization code + PKCE from the page, as a public client (no secret). Discovery follows the
// same rules as the BFF's (@fluid/shared). The authorization server must allow CORS from fluid.

export class BrowserOAuthError extends Error {}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface AuthServer {
  as: AuthorizationServer;
  authorizationEndpoint: string;
  /** Whether the metadata advertises PKCE `S256` (required to sign in). */
  s256: boolean;
}

/** The first well-known document that describes this issuer exactly, with usable endpoints. */
export async function discoverAuthServer(issuer: string, fetchFn: FetchLike): Promise<AuthServer> {
  const issuerUrl = new URL(issuer);
  for (const candidate of metadataCandidates(issuer)) {
    try {
      const response = await fetchFn(candidate, { headers: { accept: 'application/json' } });
      if (!response.ok) continue;
      const as = await processDiscoveryResponse(issuerUrl, response.clone());
      const meta = authServerMetadataSchema.parse(await response.json());
      if (!endpointsAllowed(issuer, [meta.authorization_endpoint, meta.token_endpoint])) continue;
      return {
        as,
        authorizationEndpoint: meta.authorization_endpoint,
        s256: meta.code_challenge_methods_supported?.includes('S256') ?? false,
      };
    } catch {
      continue;
    }
  }
  throw new BrowserOAuthError('No authorization server metadata found for this issuer (or it does not allow this page to read it).');
}

/** A sign-in started from this page, waiting for its callback. Lives in memory only. */
export interface PendingSignIn {
  state: string;
  verifier: string;
  nonce: string;
  sourceUrl: string;
  settings: BrowserOAuthSettings;
  scopes: string[];
  redirectUri: string;
  server: AuthServer;
  createdAt: number;
}

/** The authorization URL to open, and what the callback needs to finish the sign-in. */
export async function startSignIn(
  sourceUrl: string,
  settings: BrowserOAuthSettings,
  server: AuthServer,
  redirectUri: string,
  now: number,
  extraScope?: string,
): Promise<{ url: string; pending: PendingSignIn }> {
  if (!server.s256) throw new BrowserOAuthError('The authorization server does not support PKCE S256.');
  const verifier = generateRandomCodeVerifier();
  const state = generateRandomState();
  const nonce = generateRandomNonce();
  const scopes = [...new Set([...settings.scopes, ...(extraScope ? extraScope.split(/\s+/).filter(Boolean) : [])])];
  const url = new URL(server.authorizationEndpoint);
  const params: Record<string, string> = {
    response_type: 'code',
    client_id: settings.clientId,
    redirect_uri: redirectUri,
    state,
    nonce,
    code_challenge: await calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    ...(scopes.length ? { scope: scopes.join(' ') } : {}),
    ...(settings.resource ? { resource: settings.resource } : {}),
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.href, pending: { state, verifier, nonce, sourceUrl, settings, scopes, redirectUri, server, createdAt: now } };
}

/** Checks the callback (state, `iss`, error), exchanges the code with the verifier, keeps the access token. */
export async function finishSignIn(pending: PendingSignIn, callback: URL, fetchFn: FetchLike, now: number): Promise<MemoryToken> {
  const { as } = pending.server;
  const client = { client_id: pending.settings.clientId };
  const params = validateAuthResponse(as, client, callback, pending.state);
  const tokenEndpoint = as.token_endpoint ?? '';
  const response = await authorizationCodeGrantRequest(as, client, None(), params, pending.redirectUri, pending.verifier, {
    [customFetch]: fetchFn,
    ...(tokenEndpoint.startsWith('http://') ? { [allowInsecureRequests]: true } : {}),
    ...(pending.settings.resource ? { additionalParameters: { resource: pending.settings.resource } } : {}),
  });
  // With `openid` the server must return an ID token carrying our nonce; plain OAuth has none.
  const oidc = pending.scopes.includes('openid');
  const result = await processAuthorizationCodeResponse(as, client, response, oidc ? { expectedNonce: pending.nonce } : {});
  return toMemoryToken(result, now, settingsFingerprint(pending.settings), pending.scopes);
}

/** The sign-ins waiting for their callback, by `state`: each one is taken once, and expires. */
export function createPendingSignIns(ttlMs = 10 * 60_000) {
  const byState = new Map<string, PendingSignIn>();
  return {
    add: (p: PendingSignIn) => byState.set(p.state, p),
    take(state: string | null, now: number): PendingSignIn | null {
      if (!state) return null;
      const p = byState.get(state);
      byState.delete(state);
      return p && now - p.createdAt <= ttlMs ? p : null;
    },
    /** Drops the sign-ins started for a source (another one started, or the user left). */
    dropFor: (sourceUrl: string) => {
      for (const [state, p] of byState) if (p.sourceUrl === sourceUrl) byState.delete(state);
    },
  };
}
