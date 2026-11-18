import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { createStorage, type Storage } from '../storage/client';
import { createCredentialRepository } from '../sources/oauth/credentials';
import { createOAuthService } from '../sources/oauth/service';
import { createSourceRepository } from '../sources/repository';
import { createSourceService } from '../sources/service';
import type { HostCheck } from '../sources/host-policy';
import { logSerializers } from '../log';
import { oauthRoutes } from '../routes/oauth';
import { CLIENT_ID, CLIENT_SECRET, createStubAs, createStubResource } from './oauth-stub';
import { sourceRoutes } from '../routes/sources';

// Test support: the real routes and services over in-memory PGlite, with stub servers.

export interface HarnessOptions {
  publicUrl?: string;
  hostCheck?: HostCheck;
}

export async function startHarness({ publicUrl, hostCheck }: HarnessOptions = {}) {
  const storage: Storage = createStorage({ kind: 'pglite', dataDir: 'memory://' });
  await storage.init();
  const as = await createStubAs();
  const resource = await createStubResource(() => as.issuer);
  const logs: string[] = [];
  const clock = { t: Date.now() };
  const key = randomBytes(32);
  const sources = createSourceRepository(storage.prisma);
  const oauth = createOAuthService({
    sources,
    creds: createCredentialRepository(storage.prisma),
    key: () => key,
    net: { timeoutMs: 2000, ...(hostCheck ? { hostCheck } : {}) },
    now: () => clock.t,
  });
  const service = createSourceService(sources, () => key, { timeoutMs: 2000, oauth, ...(hostCheck ? { hostCheck } : {}) });
  const app: FastifyInstance = Fastify({
    logger: { level: 'trace', serializers: logSerializers, stream: { write: (line: string) => void logs.push(line) } },
  });
  await app.register(sourceRoutes, { service });
  await app.register(oauthRoutes, { oauth, publicUrl });
  await app.ready();

  const createSource = async (over: { oauth?: object; url?: string } = {}) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sources',
      payload: {
        name: 'O',
        url: over.url ?? resource.graphqlUrl(),
        authKind: 'oauth',
        oauth: { issuer: as.issuer, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, scopes: ['read'], ...over.oauth },
      },
    });
    return { res, id: (res.json() as { id: string }).id };
  };
  const start = (id: string, query = '') => app.inject({ method: 'GET', url: `/api/sources/${id}/oauth/start${query}` });
  const callback = (query: string, cookie?: string) =>
    app.inject({ method: 'GET', url: `/api/oauth/callback?${query}`, headers: cookie ? { cookie } : {} });
  const cookieOf = (res: { headers: Record<string, unknown> }) => String(res.headers['set-cookie'] ?? '').split(';')[0];
  /**
   * Runs start, plays the browser at the authorization server, then hits the callback.
   * `nonce` overrides the ID token nonce the server returns (default: the one it was sent).
   */
  const signIn = async (id: string, opts: { query?: string; idTokenNonce?: string | null } = {}) => {
    const started = await start(id, opts.query);
    const location = new URL(started.headers.location as string);
    const nonce = opts.idTokenNonce === undefined ? location.searchParams.get('nonce') : opts.idTokenNonce;
    const code = as.issueCode(
      location.searchParams.get('code_challenge') ?? '',
      location.searchParams.get('redirect_uri') ?? '',
      location.searchParams.get('scope')?.split(' ').includes('openid') ? (nonce ?? undefined) : undefined,
    );
    const cookie = cookieOf(started);
    const cb = await callback(`code=${code}&state=${location.searchParams.get('state')}`, cookie);
    return { started, location, code, cb, cookie };
  };
  const run = (id: string) =>
    app.inject({ method: 'POST', url: `/api/sources/${id}/graphql`, payload: { query: '{ ok }' } });

  return {
    app,
    storage,
    as,
    resource,
    logs,
    clock,
    createSource,
    start,
    callback,
    cookieOf,
    signIn,
    run,
    reset: () => {
      as.reset();
      resource.state.mode = 'ok';
      resource.state.prmUrl = null;
      resource.state.prmResource = null;
      resource.state.seen = [];
      logs.length = 0;
      clock.t += 3600_000; // expires the discovery cache
    },
    close: async () => {
      await app.close();
      await storage.close();
      await as.close();
      await resource.close();
    },
  };
}
export type Harness = Awaited<ReturnType<typeof startHarness>>;
