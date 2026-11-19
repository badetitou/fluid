import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { invokeActionBody, type ViewActionService } from '../views/action-service';
import { secretAwareErrorHandler } from './error-handler';

// Runs an action of a saved view on a source that allows writes (MCP hosts). No mutation text is accepted.

export async function viewActionRoutes(app: FastifyInstance, { service }: { service: ViewActionService }) {
  app.setErrorHandler(secretAwareErrorHandler);

  app.post('/api/views/:id/actions/:action', async (req, reply) => {
    const { id, action } = req.params as { id: string; action: string };
    const parsed = invokeActionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    const out = await service.invoke(id, action, parsed.data);
    switch (out.kind) {
      case 'view-not-found':
        return reply.code(404).send({ error: 'View not found' });
      case 'action-not-found':
        return reply.code(404).send({ error: 'Action not found in this view' });
      case 'source-not-found':
        return reply.code(404).send({ error: 'Source not found' });
      case 'writes-disabled':
        return reply.code(403).send({ error: 'Changes are not allowed on this source: turn on "Allow changes" in fluid (Settings → Connection).' });
      case 'invalid':
        return reply.code(422).send({ error: out.error });
      case 'auth-required':
        return reply.code(out.status).send(out.body);
      case 'ran':
        return { ...(out.data !== undefined ? { data: out.data } : {}), ...(out.errors ? { errors: out.errors } : {}) };
    }
  });
}
