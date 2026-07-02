import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '../db';

// A tiny key/value preferences store (mono-user demo): navbar side, etc.

async function readAll(): Promise<Record<string, unknown>> {
  const rows = await prisma.preference.findMany();
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function prefRoutes(app: FastifyInstance) {
  app.get('/api/prefs', async () => readAll());

  app.put('/api/prefs', async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ error: 'Body must be a JSON object of preferences.' });
    }
    const entries = Object.entries(body as Record<string, unknown>);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.preference.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
    );
    return readAll();
  });
}
