import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { addGithubRepoBody } from '@fluid/shared';
import type { GithubSource } from '../repos/service';
import { graphqlBody } from '../sources/model';

// GitHub source: add/list/remove analysed public repositories and proxy GraphQL to their Model
// server. Registered only when FLUID_REPOS_ENABLED is set; everything goes through the service.

const GRAPHQL_BODY_LIMIT = 1024 * 1024;
const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'Repository not found' });
const invalid = (reply: FastifyReply, error: z.ZodError) =>
  reply.code(400).send({ error: 'Invalid body', details: z.flattenError(error) });

export interface GithubRepoRoutesOptions {
  service: GithubSource;
}

export async function githubRepoRoutes(app: FastifyInstance, { service }: GithubRepoRoutesOptions) {
  app.addHook('onClose', () => service.stopAll());

  app.get('/api/github-repos', () => service.list());

  app.get('/api/github-repos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return service.get(id) ?? notFound(reply);
  });

  app.post('/api/github-repos', async (req, reply) => {
    const parsed = addGithubRepoBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    return reply.code(202).send(service.add(parsed.data));
  });

  app.delete('/api/github-repos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await service.remove(id)) ? reply.code(204).send() : notFound(reply);
  });

  app.post('/api/github-repos/:id/graphql', { bodyLimit: GRAPHQL_BODY_LIMIT }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = graphqlBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    const result = await service.runGraphql(id, parsed.data);
    if (!result) return notFound(reply);
    return reply.code(result.status).send(result.body);
  });
}
