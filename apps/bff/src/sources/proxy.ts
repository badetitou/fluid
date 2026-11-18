import { upstreamEnvelope, type GraphqlBody, type UpstreamEnvelope } from './model';

export const UPSTREAM_TIMEOUT_MS = 30_000;
export const MAX_UPSTREAM_BYTES = 10 * 1024 * 1024;

export interface ProxyResult {
  status: number;
  body: UpstreamEnvelope;
}

const gatewayError = (status: number, message: string): ProxyResult => ({
  status,
  body: { errors: [{ message }] },
});

/** Reads at most `max` bytes of the body; null when it is larger. */
async function readCapped(res: Response, max: number): Promise<string | null> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * POSTs a GraphQL request to `url` with `headers` (which may hold a secret: never logged, never
 * echoed in an error). The upstream status and GraphQL errors are passed through; a reply that is
 * not a GraphQL envelope becomes a generic error with the upstream status (or 502 when it was 2xx).
 * Redirects are refused so the secret header cannot follow one to another host.
 */
export async function forwardGraphql(
  url: string,
  headers: Record<string, string>,
  body: GraphqlBody,
  opts: { timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch } = {},
): Promise<ProxyResult> {
  const { timeoutMs = UPSTREAM_TIMEOUT_MS, maxBytes = MAX_UPSTREAM_BYTES, fetchImpl = fetch } = opts;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: JSON.stringify({
        query: body.query,
        ...(body.variables ? { variables: body.variables } : {}),
        ...(body.operationName ? { operationName: body.operationName } : {}),
      }),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return timedOut ? gatewayError(504, 'Source timed out') : gatewayError(502, 'Source is unreachable');
  }

  const text = await readCapped(res, maxBytes).catch(() => undefined);
  if (text === null) return gatewayError(502, 'Source response is too large');
  if (text === undefined) return gatewayError(502, 'Source response could not be read');

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const envelope = upstreamEnvelope.safeParse(json);
  if (envelope.success && (envelope.data.data !== undefined || envelope.data.errors !== undefined)) {
    return { status: res.status, body: envelope.data };
  }
  return res.ok
    ? gatewayError(502, 'Source did not return a GraphQL response')
    : gatewayError(res.status, `Source responded with HTTP ${res.status}`);
}
