import Fastify from 'fastify';
import cors from '@fastify/cors';
import { viewRoutes } from './routes/views';
import { prefRoutes } from './routes/prefs';
import { llmRoutes } from './routes/llm';

export function buildApp() {
  const app = Fastify({ logger: true });

  // @fastify/cors only allows GET,HEAD,POST by default; views are also updated and deleted.
  app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });

  app.get('/health', async () => ({ status: 'ok', service: 'fluid-bff' }));

  app.register(viewRoutes);
  app.register(prefRoutes);
  app.register(llmRoutes);

  return app;
}
