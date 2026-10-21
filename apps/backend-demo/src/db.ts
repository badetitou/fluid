import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

// Prisma 7 talks to Postgres through the `pg` driver adapter, which ignores the
// `?schema=` URL parameter Prisma used to honour — so we forward it explicitly.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const schema = new URL(url).searchParams.get('schema') ?? undefined;

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }, { schema }),
});
