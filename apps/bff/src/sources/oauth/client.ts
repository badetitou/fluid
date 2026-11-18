import {
  ClientSecretBasic,
  ClientSecretPost,
  None,
  allowInsecureRequests,
  customFetch,
  type Client,
  type ClientAuth,
  type TokenEndpointResponse,
} from 'oauth4webapi';
import { z } from 'zod';
import type { AuthServerInfo } from './discovery';
import type { SafeFetch } from './safe-fetch';

// Glue between a source's OAuth config and oauth4webapi: client authentication, request
// options (our safe fetch, http allowed because sources may be http), and the stored token shape.

/** The OAuth part of a source row (secret still encrypted). */
export interface OAuthSource {
  id: string;
  url: string;
  authKind: string;
  oauthIssuer: string | null;
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthScopes: string | null;
  oauthResource: string | null;
}

/** Confidential client: Basic unless the server only lists POST; no secret: public client. */
export function clientFor(
  clientId: string,
  clientSecret: string | null,
  info: Pick<AuthServerInfo, 'authMethods'>,
): { client: Client; auth: ClientAuth } {
  if (!clientSecret) return { client: { client_id: clientId }, auth: None() };
  const post = info.authMethods.includes('client_secret_post') && !info.authMethods.includes('client_secret_basic');
  return { client: { client_id: clientId }, auth: post ? ClientSecretPost(clientSecret) : ClientSecretBasic(clientSecret) };
}

export function requestOptions(url: string, fetchOut: SafeFetch, resource: string | null) {
  return {
    [customFetch]: fetchOut,
    ...(url.startsWith('http://') ? { [allowInsecureRequests]: true } : {}),
    ...(resource ? { additionalParameters: { resource } } : {}),
  };
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('bearer'),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional(),
});

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

/** Validates the token endpoint answer; a rotated refresh token wins, else the previous one is kept. */
export function toStoredTokens(
  response: TokenEndpointResponse,
  now: number,
  previous?: { refreshToken: string | null; scope: string | null },
): StoredTokens {
  const t = tokenResponse.parse(response);
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: t.expires_in ? new Date(now + t.expires_in * 1000) : null,
    scope: t.scope ?? previous?.scope ?? null,
  };
}
