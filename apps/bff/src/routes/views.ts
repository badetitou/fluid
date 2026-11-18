import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createViewBody, updateViewBody, updateWidgetBody } from '../validation';
import type { ViewService } from '../views/service';

// CRUD for persisted dashboard views: HTTP in and out, everything else in the service.

const invalid = (reply: FastifyReply, error: z.ZodError) =>
  reply.code(400).send({ error: 'Invalid body', details: z.flattenError(error) });
const viewNotFound = (reply: FastifyReply) => reply.code(404).send({ error: 'View not found' });

export interface ViewRoutesOptions {
  service: ViewService;
}

export async function viewRoutes(app: FastifyInstance, { service }: ViewRoutesOptions) {
  app.get('/api/views', async (req) => {
    const { concept } = (req.query ?? {}) as { concept?: string };
    return service.list(concept);
  });

  app.get('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await service.get(id)) ?? viewNotFound(reply);
  });

  app.post('/api/views', async (req, reply) => {
    const parsed = createViewBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    return reply.code(201).send(await service.create(parsed.data.spec, parsed.data.isDefault));
  });

  app.put('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateViewBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    return (await service.update(id, parsed.data)) ?? viewNotFound(reply);
  });

  app.patch('/api/views/:id/widgets/:widgetId', async (req, reply) => {
    const { id, widgetId } = req.params as { id: string; widgetId: string };
    const parsed = updateWidgetBody.safeParse(req.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    const result = await service.updateWidget(id, widgetId, parsed.data.widget);
    if ('view' in result) return result.view;
    return result.missing === 'view' ? viewNotFound(reply) : reply.code(404).send({ error: 'Widget not found in view' });
  });

  app.delete('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    return (await service.remove(id)) ? reply.code(204).send() : viewNotFound(reply);
  });
}
