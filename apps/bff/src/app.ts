import Fastify from 'fastify';
import cors from '@fastify/cors';
import { viewRoutes } from './routes/views';
import { prefRoutes } from './routes/prefs';
import { llmRoutes } from './routes/llm';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'fluid-bff' }));

  app.register(viewRoutes);
  app.register(prefRoutes);
  app.register(llmRoutes);

  return app;
}
