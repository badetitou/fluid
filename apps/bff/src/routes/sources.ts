import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSourceBody, graphqlBody, updateSourceBody } from '../sources/model';
import type { SourceService } from '../sources/service';
import { secretAwareErrorHandler } from './error-handler';

// Source configs (CRUD, secret write-only) and the GraphQL proxy for a configured source.
// Everything goes through the service; the only reachable URLs are the configured ones.

const GRAPHQL_BODY_LIMIT = 1024 * 1024;
const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Source not found' });
const invalid = (reply: FastifyReply, error: z.ZodError) =>
  reply.code(400).send({ error: 'Invalid body', details: z.flattenError(error) });

export interface SourceRoutesOptions {
  service: SourceService;
}

export async function sourceRoutes(app: FastifyInstance, { service }: SourceRoutesOptions) {
  app.setErrorHandler(secretAwareErrorHandler);

  app.get('/api/sources', () => service.list());

  app.get('/api/sources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await service.get(id)) ?? notFound(reply);
  });

  app.post('/api/sources', async (req, reply) => {
    const parsed = createSourceBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    return reply.code(201).send(await service.create(parsed.data));
  });

  app.put('/api/sources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSourceBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    return (await service.update(id, parsed.data)) ?? notFound(reply);
  });

  app.delete('/api/sources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await service.remove(id)) ? reply.code(204).send() : notFound(reply);
  });

  app.post('/api/sources/:id/graphql', { bodyLimit: GRAPHQL_BODY_LIMIT }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = graphqlBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    const result = await service.runGraphql(id, parsed.data);
    if (!result) return notFound(reply);
    return reply.code(result.status).send(result.body);
  });
}
