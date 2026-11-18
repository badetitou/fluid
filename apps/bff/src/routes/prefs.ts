import type { FastifyInstance } from 'fastify';
import type { PrefService } from '../prefs/service';
import { prefsBody } from '../validation';

// A tiny key/value preferences store (mono-user demo): navbar side, etc.

export interface PrefRoutesOptions {
  service: PrefService;
}

export async function prefRoutes(app: FastifyInstance, { service }: PrefRoutesOptions) {
  app.get('/api/prefs', () => service.all());

  app.put('/api/prefs', async (req, reply) => {
    const parsed = prefsBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Body must be a JSON object of preferences.' });
    return service.put(parsed.data);
  });
}
