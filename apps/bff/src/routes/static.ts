import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { renderRuntimeConfig } from '../runtime-config';

const NO_STORE = 'no-store';

function isApiPath(url: string): boolean {
  return url === '/api' || url.startsWith('/api/') || url.startsWith('/api?');
}

/**
 * Single-process mode: serve the built frontend at `/`, a generated /config.js,
 * and fall back to index.html for unknown non-/api GET paths (SPA routing).
 */
export async function staticRoutes(app: FastifyInstance, opts: { dir: string }) {
  const configJs = renderRuntimeConfig(process.env);

  app.get('/config.js', async (_req, reply) =>
    reply
      .header('Content-Type', 'application/javascript; charset=utf-8')
      .header('Cache-Control', NO_STORE)
      .send(configJs),
  );

  await app.register(fastifyStatic, {
    root: opts.dir,
    setHeaders: (reply, filePath) => {
      if (filePath.endsWith('index.html')) reply.header('Cache-Control', NO_STORE);
    },
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.method === 'GET' && !isApiPath(req.url)) {
      return reply.header('Cache-Control', NO_STORE).type('text/html; charset=utf-8').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });
}
