import { processDiscoveryResponse, type AuthorizationServer } from 'oauth4webapi';
import { authServerMetadataSchema, endpointsAllowed, metadataCandidates, resourceMatches } from '@fluid/shared';
import { z } from 'zod';
import { parseBearerChallenge } from './challenge';
import { isIssuerUrl } from '../url';
import type { SafeFetch } from './safe-fetch';

// Authorization server metadata (RFC 8414, then OpenID Connect Discovery, in the path-insertion
// order of the MCP authorization spec 2025-11-25) and protected resource metadata (RFC 9728).
// The pure rules live in @fluid/shared, shared with the browser-only fallback.

export class DiscoveryError extends Error {}

export interface AuthServerInfo {
  as: AuthorizationServer;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  /** Whether the metadata advertises PKCE `S256` (required to sign in). */
  s256: boolean;
  scopesSupported: string[];
  authMethods: string[];
}

export async function discoverAuthorizationServer(issuer: string, fetchOut: SafeFetch): Promise<AuthServerInfo> {
  if (!isIssuerUrl(issuer)) throw new DiscoveryError('Invalid issuer');
  // The metadata's `issuer` must equal the identifier exactly (only the well-known URLs trim it).
  const issuerUrl = new URL(issuer);
  for (const candidate of metadataCandidates(issuer)) {
    let response: Response;
    try {
      response = await fetchOut(candidate, { headers: { accept: 'application/json' } });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    try {
      const as = await processDiscoveryResponse(issuerUrl, response.clone());
      const meta = authServerMetadataSchema.parse(await response.json());
      if (!endpointsAllowed(issuer, [meta.authorization_endpoint, meta.token_endpoint])) continue;
      return {
        as,
        authorizationEndpoint: meta.authorization_endpoint,
        tokenEndpoint: meta.token_endpoint,
        s256: meta.code_challenge_methods_supported?.includes('S256') ?? false,
        scopesSupported: meta.scopes_supported ?? [],
        authMethods: meta.token_endpoint_auth_methods_supported ?? [],
      };
    } catch {
      continue;
    }
  }
  throw new DiscoveryError('No authorization server metadata found for this issuer');
}

/** Memoizes discovery per issuer for a short while (single process). */
export function createDiscoverer(fetchOut: SafeFetch, ttlMs = 5 * 60_000, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; info: AuthServerInfo }>();
  return async (issuer: string): Promise<AuthServerInfo> => {
    const hit = cache.get(issuer);
    if (hit && now() - hit.at < ttlMs) return hit.info;
    const info = await discoverAuthorizationServer(issuer, fetchOut);
    cache.set(issuer, { at: now(), info });
    return info;
  };
}

const resourceMetadata = z.looseObject({
  resource: z.string().optional(),
  authorization_servers: z.array(z.string()).optional(),
  scopes_supported: z.array(z.string()).optional(),
});

export interface ProtectedResourceInfo {
  resource: string | null;
  authorizationServers: string[];
  scopes: string[];
}

/**
 * RFC 9728: probes the source without credentials; on a 401 whose `WWW-Authenticate: Bearer`
 * carries `resource_metadata`, reads that document. It is only trusted when it sits on the
 * source's own origin and its `resource` matches the probed URL; otherwise null.
 */
export async function discoverProtectedResource(sourceUrl: string, fetchOut: SafeFetch): Promise<ProtectedResourceInfo | null> {
  let probe: Response;
  try {
    probe = await fetchOut(sourceUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
  } catch {
    return null;
  }
  const { resourceMetadata: docUrl } = parseBearerChallenge(probe.headers.get('www-authenticate'));
  if (probe.status !== 401 || !docUrl) return null;
  try {
    const target = new URL(docUrl, sourceUrl);
    if (target.origin !== new URL(sourceUrl).origin) return null;
    const doc = resourceMetadata.parse(await (await fetchOut(target.href, { headers: { accept: 'application/json' } })).json());
    if (!doc.resource || !resourceMatches(doc.resource, sourceUrl)) return null;
    return {
      resource: doc.resource,
      authorizationServers: (doc.authorization_servers ?? []).filter(isIssuerUrl),
      scopes: doc.scopes_supported ?? [],
    };
  } catch {
    return null;
  }
}
