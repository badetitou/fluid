import 'dotenv/config';
import { buildApp } from './app';
import { initDb, storageMode } from './db';

const port = Number(process.env.PORT ?? 4001);
const app = buildApp();

async function main() {
  // Migrations must finish before the first request is served.
  await initDb();
  app.log.info(
    storageMode.kind === 'pglite' ? `storage: PGlite in ${storageMode.dataDir}` : 'storage: Postgres',
  );
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
