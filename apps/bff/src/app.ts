import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logSerializers } from './log';
import { viewRoutes } from './routes/views';
import { prefRoutes } from './routes/prefs';
import { llmRoutes } from './routes/llm';
import { staticRoutes } from './routes/static';
import { sourceRoutes } from './routes/sources';
import { oauthRoutes } from './routes/oauth';
import { githubRepoRoutes } from './routes/github-repos';
import { readGithubSourceConfig } from './repos/config';
import { createGithubSource } from './repos/service';
import { githubSourceDeps } from './repos/wiring';
import { prisma, storageMode } from './db';
import { createKeyProvider } from './sources/crypto';
import { createCredentialRepository } from './sources/oauth/credentials';
import { createOAuthService } from './sources/oauth/service';
import { createSourceRepository } from './sources/repository';
import { createSourceService } from './sources/service';
import { viewRunRoutes } from './routes/view-run';
import { viewActionRoutes } from './routes/view-action';
import { viewDraftRoutes } from './routes/view-draft';
import { createViewActionService } from './views/action-service';
import { createViewDraftService } from './views/draft-service';
import { createActionLog, createViewReader, createViewWriter } from './views/repository';
import { createViewRunService } from './views/run-service';
import { createSchemaLookup } from './views/schema-check';

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
  if (process.env.NODE_ENV === 'production' && !process.env.FLUID_PUBLIC_URL) {
    app.log.warn('FLUID_PUBLIC_URL is not set: the OAuth redirect URI is built from request headers. Set it in production.');
  }
  const key = createKeyProvider(process.env, storageMode);
  const sources = createSourceRepository(prisma);
  const oauth = createOAuthService({ sources, creds: createCredentialRepository(prisma), key });
  const sourceService = createSourceService(sources, key, { oauth });
  app.register(sourceRoutes, { service: sourceService });
  const runs = createViewRunService(createViewReader(prisma), sourceService);
  app.register(viewRunRoutes, { service: runs });
  const drafts = createViewDraftService({
    sources: sourceService,
    schemas: createSchemaLookup(sourceService),
    runs,
    writer: createViewWriter(prisma),
  });
  app.register(viewDraftRoutes, { service: drafts });
  const actions = createViewActionService({
    views: createViewReader(prisma),
    sources: sourceService,
    log: createActionLog(prisma),
    onLogError: (err) => app.log.error({ err: { message: err instanceof Error ? err.message : String(err) } }, 'view action ran but was not logged'),
  });
  app.register(viewActionRoutes, { service: actions });
  app.register(oauthRoutes, { oauth, publicUrl: process.env.FLUID_PUBLIC_URL });
  const github = readGithubSourceConfig(process.env);
  if (github.enabled) {
    app.register(githubRepoRoutes, { service: createGithubSource(github, githubSourceDeps(github)) });
  }

  const staticDir = options.staticDir ?? process.env.FLUID_STATIC_DIR;
  if (staticDir) app.register(staticRoutes, { dir: staticDir });

  return app;
}
