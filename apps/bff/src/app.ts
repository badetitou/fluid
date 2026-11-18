import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logSerializers } from './log';
import { viewRoutes } from './routes/views';
import { prefRoutes } from './routes/prefs';
import { llmRoutes } from './routes/llm';
import { staticRoutes } from './routes/static';
import { sourceRoutes } from './routes/sources';
import { oauthRoutes } from './routes/oauth';
import { prisma, storageMode } from './db';
import { createKeyProvider } from './sources/crypto';
import { createCredentialRepository } from './sources/oauth/credentials';
import { createOAuthService } from './sources/oauth/service';
import { createSourceRepository } from './sources/repository';
import { createSourceService } from './sources/service';

export interface BuildAppOptions {
  /** Built frontend directory; defaults to FLUID_STATIC_DIR. Unset = API only. */
  staticDir?: string;
  /** Fastify log level (default info). */
  logLevel?: string;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info', serializers: logSerializers } });

  // @fastify/cors only allows GET,HEAD,POST by default; views are also updated and deleted.
  app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });

  app.get('/health', async () => ({ status: 'ok', service: 'fluid-bff' }));

  app.register(viewRoutes);
  app.register(prefRoutes);
  app.register(llmRoutes);
  const key = createKeyProvider(process.env, storageMode);
  const sources = createSourceRepository(prisma);
  const oauth = createOAuthService({ sources, creds: createCredentialRepository(prisma), key });
  app.register(sourceRoutes, { service: createSourceService(sources, key, { oauth }) });
  app.register(oauthRoutes, { oauth, publicUrl: process.env.FLUID_PUBLIC_URL });

  const staticDir = options.staticDir ?? process.env.FLUID_STATIC_DIR;
  if (staticDir) app.register(staticRoutes, { dir: staticDir });

  return app;
}
