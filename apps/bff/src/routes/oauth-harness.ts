import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { createStorage, type Storage } from '../storage/client';
import { createCredentialRepository } from '../sources/oauth/credentials';
import { createOAuthService } from '../sources/oauth/service';
import { createSourceRepository } from '../sources/repository';
import { createSourceService } from '../sources/service';
import { logSerializers } from '../log';
import { oauthRoutes } from './oauth';
import { CLIENT_ID, CLIENT_SECRET, createStubAs, createStubResource } from './oauth-stub';
import { sourceRoutes } from './sources';

// Test support: the real routes and services over in-memory PGlite, with stub servers.

export async function startHarness(publicUrl?: string) {
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
    net: { timeoutMs: 2000 },
    now: () => clock.t,
  });
  const service = createSourceService(sources, () => key, { timeoutMs: 2000, oauth });
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
  const callback = (query: string) => app.inject({ method: 'GET', url: `/api/oauth/callback?${query}` });
  /** Runs start, plays the browser at the authorization server, then hits the callback. */
  const signIn = async (id: string) => {
    const started = await start(id);
    const location = new URL(started.headers.location as string);
    const code = as.issueCode(
      location.searchParams.get('code_challenge') ?? '',
      location.searchParams.get('redirect_uri') ?? '',
    );
    const cb = await callback(`code=${code}&state=${location.searchParams.get('state')}`);
    return { started, location, code, cb };
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
    signIn,
    run,
    reset: () => {
      as.reset();
      resource.state.mode = 'ok';
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
