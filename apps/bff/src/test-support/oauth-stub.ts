import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// Test support: a stub authorization server (metadata, token endpoint with PKCE / resource /
// client-secret checks and refresh-token rotation; `/authorize` auto-approves) and a stub protected resource.

export const CLIENT_ID = 'fluid-client';
export const CLIENT_SECRET = 'client-secret-xyz';

export interface StubAsOptions {
  /** Where the metadata lives: RFC 8414, OIDC (path insertion) or OIDC (appended to the issuer). */
  metadata: 'oauth2' | 'oidc' | 'oidc-append';
  issuerPath: string;
  s256: boolean;
  rotate: boolean;
  expiresIn: number;
  expectResource: string | null;
  refreshFails: boolean;
  /** HTTP status of a failing refresh (400 invalid_grant, or e.g. 503). */
  refreshStatus: number;
  /** Scope named in the code-exchange response (null: none, the client must fall back). */
  codeScope: string | null;
  tokenDelayMs: number;
}

const defaults = (): StubAsOptions => ({
  metadata: 'oauth2',
  issuerPath: '',
  s256: true,
  rotate: true,
  expiresIn: 3600,
  expectResource: null,
  refreshFails: false,
  refreshStatus: 400,
  codeScope: 'read',
  tokenDelayMs: 0,
});

const listen = async (server: Server, port = 0) => {
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
const readBody = (req: NodeJS.ReadableStream) =>
  new Promise<string>((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
  });

/** `port` 0 picks a free one; a fixed port serves the by-hand runner (`run-oauth-stub.ts`). */
export async function createStubAs(port = 0) {
  const opts = defaults();
  const metadataHits: string[] = [];
  const tokenCalls: { params: URLSearchParams; headers: IncomingHttpHeaders }[] = [];
  const codes = new Map<string, { challenge: string; redirectUri: string; nonce?: string }>();
  const refreshTokens = new Set<string>();
  const accessTokens = new Set<string>();
  let base = '';
  let counter = 0;

  const idToken = (nonce: string) => {
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: base + opts.issuerPath, aud: CLIENT_ID, sub: 'user-1', iat: now, exp: now + 300, nonce };
    return `${part({ alg: 'RS256' })}.${part(claims)}.c2ln`;
  };
  const issue = (
    res: import('node:http').ServerResponse,
    extra: { scope?: string | null; refresh?: boolean; nonce?: string } = {},
  ) => {
    const refresh = `rt-${++counter}-${randomBytes(4).toString('hex')}`;
    if (extra.refresh !== false) refreshTokens.add(refresh);
    const access = `at-${counter}-${randomBytes(4).toString('hex')}`;
    accessTokens.add(access);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(
      JSON.stringify({
        access_token: access,
        token_type: 'Bearer',
        expires_in: opts.expiresIn,
        ...(extra.refresh !== false ? { refresh_token: refresh } : {}),
        ...(extra.scope === null ? {} : { scope: extra.scope ?? 'read' }),
        ...(extra.nonce !== undefined ? { id_token: idToken(extra.nonce) } : {}),
      }),
    );
  };
  const fail = (res: import('node:http').ServerResponse, status: number, error: string) =>
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ error }));

  const grantCode = (challenge: string, redirectUri: string, nonce?: string) => {
    const code = `code-${randomBytes(6).toString('hex')}`;
    codes.set(code, { challenge, redirectUri, nonce });
    return code;
  };
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', base).pathname;
    if (path.includes('/.well-known/')) {
      metadataHits.push(path);
      const served = {
        oauth2: `/.well-known/oauth-authorization-server${opts.issuerPath}`,
        oidc: `/.well-known/openid-configuration${opts.issuerPath}`,
        'oidc-append': `${opts.issuerPath}/.well-known/openid-configuration`,
      }[opts.metadata];
      if (path !== served) return void res.writeHead(404).end();
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          issuer: base + opts.issuerPath,
          authorization_endpoint: `${base}/authorize`,
          token_endpoint: `${base}/token`,
          code_challenge_methods_supported: opts.s256 ? ['S256'] : ['plain'],
          scopes_supported: ['read', 'write'],
          token_endpoint_auth_methods_supported: ['client_secret_basic'],
        }),
      );
    }
    if (path === '/authorize' && req.method === 'GET') {
      // Auto-approves, like a user who clicks "Allow": back to the client with a code bound to its PKCE challenge.
      const q = new URL(req.url ?? '/', base).searchParams;
      const redirectUri = q.get('redirect_uri');
      const challenge = q.get('code_challenge');
      if (!redirectUri || !challenge || q.get('client_id') !== CLIENT_ID) {
        return void res.writeHead(400).end('bad authorization request');
      }
      const back = new URL(redirectUri);
      // Like a real server: an ID token (hence the nonce) only for an OpenID Connect request.
      const oidc = (q.get('scope') ?? '').split(/\s+/).includes('openid');
      back.searchParams.set('code', grantCode(challenge, redirectUri, oidc ? (q.get('nonce') ?? undefined) : undefined));
      const state = q.get('state');
      if (state) back.searchParams.set('state', state);
      return void res.writeHead(302, { location: back.toString() }).end();
    }
    if (path !== '/token' || req.method !== 'POST') return void res.writeHead(404).end();
    const params = new URLSearchParams(await readBody(req));
    tokenCalls.push({ params, headers: req.headers });
    if (opts.tokenDelayMs) await new Promise((r) => setTimeout(r, opts.tokenDelayMs));
    // RFC 6749 2.3.1: both parts are form-urlencoded before base64.
    const [id, secret] = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64')
      .toString()
      .split(':')
      .map(decodeURIComponent);
    if (id !== CLIENT_ID || secret !== CLIENT_SECRET) return fail(res, 401, 'invalid_client');
    if (opts.expectResource && params.get('resource') !== opts.expectResource) return fail(res, 400, 'invalid_target');
    if (params.get('grant_type') === 'authorization_code') {
      const entry = codes.get(params.get('code') ?? '');
      codes.delete(params.get('code') ?? '');
      const verifier = params.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (!entry || entry.challenge !== challenge || entry.redirectUri !== params.get('redirect_uri')) {
        return fail(res, 400, 'invalid_grant');
      }
      return issue(res, { scope: opts.codeScope, nonce: entry.nonce });
    }
    const refresh = params.get('refresh_token') ?? '';
    if (opts.refreshFails) return fail(res, opts.refreshStatus, opts.refreshStatus >= 500 ? 'server_error' : 'invalid_grant');
    if (!refreshTokens.has(refresh)) return fail(res, 400, 'invalid_grant');
    if (opts.rotate) refreshTokens.delete(refresh);
    return issue(res, { scope: null, refresh: opts.rotate });
  });
  base = await listen(server, port);

  return {
    opts,
    metadataHits,
    tokenCalls,
    get issuer() {
      return base + opts.issuerPath;
    },
    base,
    /** What the browser step would produce: a code bound to the PKCE challenge it was sent with. */
    issueCode: grantCode,
    /** Whether the stub issued this access token (and it was not revoked). */
    isValidToken: (token: string) => accessTokens.has(token),
    revokeAccessTokens: () => accessTokens.clear(),
    reset: () => {
      Object.assign(opts, defaults());
      metadataHits.length = 0;
      tokenCalls.length = 0;
      refreshTokens.clear();
      accessTokens.clear();
    },
    close: () => new Promise((r) => server.close(r)),
  };
}
export type StubAs = Awaited<ReturnType<typeof createStubAs>>;

export type ResourceMode = 'ok' | 'unauthorized' | 'insufficient_scope' | 'forbidden';

export async function createStubResource(asIssuer: () => string) {
  const state = {
    mode: 'ok' as ResourceMode,
    seen: [] as (string | undefined)[],
    /** Parsed JSON bodies the resource received. */
    bodies: [] as unknown[],
    url: '',
    /** Overrides of the protected resource metadata URL (header) and `resource` (document). */
    prmUrl: null as string | null,
    prmResource: null as string | null,
  };
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/.well-known/oauth-protected-resource')) {
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({ resource: state.prmResource ?? state.url, authorization_servers: [asIssuer()], scopes_supported: ['read'] }),
      );
    }
    const raw = await readBody(req);
    try {
      state.bodies.push(JSON.parse(String(raw)));
    } catch {
      state.bodies.push(raw);
    }
    state.seen.push(req.headers.authorization);
    const json = { 'content-type': 'application/json' };
    if (state.mode === 'unauthorized') {
      const doc = state.prmUrl ?? `${state.url}/.well-known/oauth-protected-resource`;
      const challenge = `Bearer resource_metadata="${doc}"`;
      return void res.writeHead(401, { ...json, 'www-authenticate': challenge }).end('{"errors":[{"message":"nope"}]}');
    }
    if (state.mode === 'forbidden') return void res.writeHead(403, json).end('{"errors":[{"message":"forbidden"}]}');
    if (state.mode === 'insufficient_scope') {
      const challenge = 'Bearer error="insufficient_scope", scope="write"';
      return void res.writeHead(403, { ...json, 'www-authenticate': challenge }).end('{"errors":[{"message":"nope"}]}');
    }
    res.writeHead(200, json).end('{"data":{"ok":true}}');
  });
  state.url = await listen(server);
  return {
    state,
    graphqlUrl: () => `${state.url}/graphql`,
    close: () => new Promise((r) => server.close(r)),
  };
}
export type StubResource = Awaited<ReturnType<typeof createStubResource>>;
