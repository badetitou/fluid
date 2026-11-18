import { readCapped } from '../proxy';

// Outbound fetch toward authorization servers and metadata documents: http(s) only, a timeout,
// a size cap, and no redirect to another origin (GET may follow same-origin redirects, anything
// else refuses them).

export const OAUTH_TIMEOUT_MS = 10_000;
export const OAUTH_MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

export type SafeFetch = (
  url: string,
  init?: { method?: string; headers?: HeadersInit; body?: BodyInit | null; signal?: AbortSignal },
) => Promise<Response>;

export interface SafeFetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

export class OutboundError extends Error {}

export function createSafeFetch(opts: SafeFetchOptions = {}): SafeFetch {
  const { fetchImpl = fetch, timeoutMs = OAUTH_TIMEOUT_MS, maxBytes = OAUTH_MAX_BYTES } = opts;
  return async (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    let current = new URL(url);
    for (let hops = 0; ; hops++) {
      if (!['http:', 'https:'].includes(current.protocol)) throw new OutboundError('Only http(s) URLs are allowed');
      const res = await fetchImpl(current, { ...init, method, redirect: 'manual', signal });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        const next = location ? new URL(location, current) : null;
        if (method !== 'GET' || !next || next.origin !== current.origin || hops >= MAX_REDIRECTS) {
          throw new OutboundError('Redirect refused');
        }
        current = next;
        continue;
      }
      const text = await readCapped(res, maxBytes);
      if (text === null) throw new OutboundError('Response is too large');
      // A body is forbidden on these statuses.
      const body = text === '' || [204, 205, 304].includes(res.status) ? null : text;
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
  };
}
