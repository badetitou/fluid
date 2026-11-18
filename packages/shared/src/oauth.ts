import { z } from 'zod';

// OAuth discovery rules shared by the BFF (confidential or public client of a source) and the
// browser-only fallback (public client in the page): pure, no I/O.

// The WHATWG URL global of browsers and Node: this package is built without DOM or Node types.
declare const URL: new (input: string) => { origin: string; pathname: string; protocol: string };

/**
 * Authorization server metadata well-known URLs to try for an issuer, in order: RFC 8414, then
 * OpenID Connect Discovery, with path insertion (MCP authorization spec 2025-11-25).
 */
export function metadataCandidates(issuer: string): string[] {
  const url = new URL(issuer);
  const path = url.pathname.replace(/\/+$/, '');
  const base = url.origin;
  if (!path) return [`${base}/.well-known/oauth-authorization-server`, `${base}/.well-known/openid-configuration`];
  return [
    `${base}/.well-known/oauth-authorization-server${path}`,
    `${base}/.well-known/openid-configuration${path}`,
    `${base}${path}/.well-known/openid-configuration`,
  ];
}

const protocolOf = (v: string) => {
  try {
    return new URL(v).protocol;
  } catch {
    return null;
  }
};

/** Endpoints that receive codes and secrets must be https when the issuer is. */
export const endpointsAllowed = (issuer: string, endpoints: string[]) =>
  protocolOf(issuer) !== 'https:' || endpoints.every((e) => protocolOf(e) === 'https:');

const endpoint = z.url({ protocol: /^https?$/ });

/** The metadata fields fluid reads (the issuer itself is checked by the OAuth library). */
export const authServerMetadataSchema = z.looseObject({
  authorization_endpoint: endpoint,
  token_endpoint: endpoint,
  code_challenge_methods_supported: z.array(z.string()).optional(),
  scopes_supported: z.array(z.string()).optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
});

/** RFC 9728: a protected resource document's `resource` must identify the probed URL (same origin, path prefix). */
export function resourceMatches(resource: string, probed: string): boolean {
  try {
    const r = new URL(resource);
    const p = new URL(probed);
    const prefix = r.pathname.replace(/\/+$/, '');
    return r.origin === p.origin && (prefix === '' || p.pathname === prefix || p.pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}
