import Fastify from 'fastify';
import cors from '@fastify/cors';
import { viewRoutes } from './routes/views';
import { prefRoutes } from './routes/prefs';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'fluid-bff' }));

  app.register(viewRoutes);
  app.register(prefRoutes);

  return app;
}
