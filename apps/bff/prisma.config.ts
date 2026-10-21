import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // process.env rather than env(): `prisma generate` must work without DATABASE_URL (e.g. Docker builds).
    url: process.env.DATABASE_URL,
  },
});
