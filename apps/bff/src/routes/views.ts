import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '../db';
import { createViewBody, updateViewBody } from '../validation';

// CRUD for persisted dashboard views. Views are stored with their full JSON
// spec plus denormalized concept/title for listing and filtering.

export async function viewRoutes(app: FastifyInstance) {
  app.get('/api/views', async (req) => {
    const { concept } = (req.query ?? {}) as { concept?: string };
    return prisma.view.findMany({
      where: concept ? { concept } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  });

  app.get('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const view = await prisma.view.findUnique({ where: { id } });
    if (!view) return reply.code(404).send({ error: 'View not found' });
    return view;
  });

  app.post('/api/views', async (req, reply) => {
    const parsed = createViewBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }
    const { spec, isDefault } = parsed.data;
    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.view.updateMany({ where: { concept: spec.concept }, data: { isDefault: false } });
      }
      return tx.view.create({
        data: {
          concept: spec.concept,
          title: spec.title,
          spec: spec as unknown as Prisma.InputJsonValue,
          isDefault: isDefault ?? false,
        },
      });
    });
    return reply.code(201).send(created);
  });

  app.put('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateViewBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }
    const existing = await prisma.view.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'View not found' });

    const { spec, title, isDefault } = parsed.data;
    const concept = spec?.concept ?? existing.concept;

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.view.updateMany({ where: { concept }, data: { isDefault: false } });
      }
      return tx.view.update({
        where: { id },
        data: {
          ...(spec
            ? {
                spec: spec as unknown as Prisma.InputJsonValue,
                concept: spec.concept,
                title: spec.title,
              }
            : {}),
          ...(title ? { title } : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
        },
      });
    });
    return updated;
  });

  // Update a single widget in a view
  app.patch('/api/views/:id/widgets/:widgetId', async (req, reply) => {
    const { id, widgetId } = req.params as { id: string; widgetId: string };
    const { widget } = req.body as { widget: any };

    if (!widget) {
      return reply.code(400).send({ error: 'Missing widget in request body' });
    }

    const existing = await prisma.view.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'View not found' });

    const spec = existing.spec as any;
    const widgetIndex = spec.widgets.findIndex((w: any) => w.id === widgetId);
    if (widgetIndex === -1) {
      return reply.code(404).send({ error: 'Widget not found in view' });
    }

    // Replace the widget, preserving the ID
    spec.widgets[widgetIndex] = {
      ...widget,
      id: widgetId,
    };

    const updated = await prisma.view.update({
      where: { id },
      data: {
        spec: spec as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  });

  app.delete('/api/views/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.view.delete({ where: { id } });
    } catch {
      return reply.code(404).send({ error: 'View not found' });
    }
    return reply.code(204).send();
  });
}
