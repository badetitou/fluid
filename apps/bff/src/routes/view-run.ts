import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runViewBody } from '../views/run-model';
import type { ViewRunService } from '../views/run-service';

// Runs the stored queries of a saved view on a configured source. No query text is accepted.

export async function viewRunRoutes(app: FastifyInstance, { service }: { service: ViewRunService }) {
  app.post('/api/views/:id/run', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = runViewBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    }
    const out = await service.run(id, parsed.data);
    switch (out.kind) {
      case 'view-not-found':
        return reply.code(404).send({ error: 'View not found' });
      case 'source-not-found':
        return reply.code(404).send({ error: 'Source not found' });
      case 'invalid-spec':
        return reply.code(422).send({ error: 'Stored view spec is invalid', issues: out.issues });
      case 'auth-required':
        return reply.code(out.status).send(out.body);
      case 'ok':
        return { results: out.results, ...(out.skipped ? { skipped: out.skipped } : {}) };
    }
  });
}
