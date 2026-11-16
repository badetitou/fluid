import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { renderRuntimeConfig } from '../runtime-config';

const NO_STORE = 'no-store';

function isApiPath(url: string): boolean {
  return url === '/api' || url.startsWith('/api/') || url.startsWith('/api?');
}

function isAssetPath(url: string): boolean {
  return url.startsWith('/assets/');
}

/**
 * Single-process mode: serve the built frontend at `/`, a generated /config.js,
 * and fall back to index.html for unknown non-/api GET paths (SPA routing).
 */
export async function staticRoutes(app: FastifyInstance, opts: { dir: string }) {
  const root = resolve(opts.dir);
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(`FLUID_STATIC_DIR "${root}" does not contain index.html`);
  }
  const configJs = renderRuntimeConfig(process.env);

  app.get('/config.js', async (_req, reply) =>
    reply
      .header('Content-Type', 'application/javascript; charset=utf-8')
      .header('Cache-Control', NO_STORE)
      .send(configJs),
  );

  await app.register(fastifyStatic, {
    root,
    setHeaders: (reply, filePath) => {
      if (filePath.endsWith('index.html')) reply.header('Cache-Control', NO_STORE);
    },
  });

  app.setNotFoundHandler(async (req, reply) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    if (isRead && !isApiPath(req.url) && !isAssetPath(req.url)) {
      return reply.header('Cache-Control', NO_STORE).type('text/html; charset=utf-8').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });
}
