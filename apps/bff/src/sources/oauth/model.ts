import { createHash } from 'node:crypto';
import { z } from 'zod';
import { httpUrl, issuerUrl } from '../url';

// Pure logic for OAuth sources: body fields, scope helpers, typed auth errors, redirect URI.

const scopeToken = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\x21\x23-\x5b\x5d-\x7e]+$/, 'invalid scope');
export const scopeList = z.array(scopeToken).max(50);

const clientSecret = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[^\r\n\0]+$/, 'secret must be a single line');

/** OAuth fields of a body; PUT makes them optional and lets `clientSecret`/`resource` be null. */
export const oauthFields = {
  issuer: issuerUrl,
  clientId: z.string().trim().min(1).max(500),
  clientSecret,
  scopes: scopeList,
  resource: httpUrl,
};

export interface OAuthRecordFields {
  oauthIssuer: string | null;
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthScopes: string | null;
  oauthResource: string | null;
}

export const splitScopes = (s: string | null | undefined): string[] => (s ?? '').split(/\s+/).filter(Boolean);
export const joinScopes = (scopes: string[]): string | null => (scopes.length ? [...new Set(scopes)].join(' ') : null);

export interface CredentialRecord {
  sourceId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

/** Public OAuth block: never the client secret nor a token. */
export function toPublicOAuth(r: OAuthRecordFields, credential: CredentialRecord | null) {
  return {
    issuer: r.oauthIssuer,
    clientId: r.oauthClientId,
    hasClientSecret: r.oauthClientSecret !== null,
    scopes: splitScopes(r.oauthScopes),
    resource: r.oauthResource,
    signedIn: credential !== null,
    expiresAt: credential?.expiresAt ?? null,
    grantedScopes: splitScopes(credential?.scope),
  };
}
export type PublicOAuth = ReturnType<typeof toPublicOAuth>;

export type AuthReason = 'signin' | 'expired' | 'insufficient_scope';

/** GraphQL error the UI keys on to offer "Sign in" / "Reconnect". */
export function authRequiredResult(reason: AuthReason, scope?: string) {
  const messages: Record<AuthReason, string> = {
    signin: 'Sign-in required for this source',
    expired: 'The sign-in to this source expired: reconnect',
    insufficient_scope: 'The sign-in to this source lacks a required scope: reconnect',
  };
  return {
    status: reason === 'insufficient_scope' ? 403 : 401,
    body: {
      errors: [
        {
          message: messages[reason],
          extensions: { code: 'FLUID_AUTH_REQUIRED', reason, ...(scope ? { scope } : {}) },
        },
      ],
    },
  };
}

/** What a token is bound to: any change to these invalidates tokens and sign-ins in flight. */
export function configFingerprint(s: {
  url: string;
  oauthIssuer: string | null;
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthScopes: string | null;
  oauthResource: string | null;
}): string {
  const parts = [new URL(s.url).origin, s.oauthIssuer, s.oauthClientId, s.oauthClientSecret, s.oauthScopes, s.oauthResource];
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Fluid's public base URL: FLUID_PUBLIC_URL when set, else the request's own origin. */
export function publicOrigin(configured: string | undefined, req: { protocol: string; host: string }): string {
  if (configured?.trim()) return new URL(configured.trim()).origin;
  return `${req.protocol}://${req.host}`;
}
export const callbackUri = (origin: string) => `${origin}/api/oauth/callback`;
