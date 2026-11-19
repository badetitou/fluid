import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { draftViewBody, saveDraftBody, type ViewDraftService } from '../views/draft-service';
import { secretAwareErrorHandler } from './error-handler';

// Views written by an assistant through MCP: preview a draft on a source, then save it.

export async function viewDraftRoutes(app: FastifyInstance, { service }: { service: ViewDraftService }) {
  app.setErrorHandler(secretAwareErrorHandler);

  app.get('/api/views/draft/schema', async (req, reply) => {
    const parsed = z.object({ sourceId: z.string().min(1) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'sourceId is required' });
    const out = await service.schema(parsed.data.sourceId);
    if (out.kind === 'source-not-found') return reply.code(404).send({ error: 'Source not found' });
    if (out.kind === 'unavailable') return reply.code(502).send({ error: `The source schema could not be read: ${out.error}` });
    return { sdl: out.sdl, truncated: out.truncated };
  });

  app.post('/api/views/draft', async (req, reply) => {
    const parsed = draftViewBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    const out = await service.draft(parsed.data);
    switch (out.kind) {
      case 'source-not-found':
        return reply.code(404).send({ error: 'Source not found' });
      case 'invalid':
        return reply.code(422).send({ error: 'Invalid view draft', issues: out.issues });
      case 'too-many-queries':
        return reply.code(422).send({ error: `Too many queries to run (max ${out.max})` });
      case 'auth-required':
        return reply.code(out.status).send(out.body);
      case 'ok':
        return { spec: out.spec, data: out.data, issues: out.issues, ...(out.skipped ? { skipped: out.skipped } : {}) };
    }
  });

  app.post('/api/views/from-draft', async (req, reply) => {
    const parsed = saveDraftBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body', details: z.flattenError(parsed.error) });
    const out = await service.save(parsed.data);
    switch (out.kind) {
      case 'source-not-found':
        return reply.code(404).send({ error: 'Source not found' });
      case 'invalid':
        return reply.code(422).send({ error: 'Invalid view draft', issues: out.issues });
      case 'ok':
        return reply.code(201).send(out.view);
    }
  });
}
