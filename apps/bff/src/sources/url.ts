import { z } from 'zod';

/** Shared by source configs and OAuth settings: an absolute http(s) URL. */
export const isHttpUrl = (v: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

export const httpUrl = z.string().trim().max(2000).refine(isHttpUrl, 'url must be an absolute http(s) URL');

/** An issuer identifier carries no query or fragment (RFC 8414). */
export const isIssuerUrl = (v: string) => isHttpUrl(v) && !new URL(v).search && !new URL(v).hash && !v.includes('?') && !v.includes('#');
export const issuerUrl = httpUrl.refine(isIssuerUrl, 'issuer must not have a query or fragment');

/** An origin only (scheme, host, port): what a browser reports as `window.location.origin`. */
export const isOrigin = (v: string) => isHttpUrl(v) && new URL(v).origin === v;
