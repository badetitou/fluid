import 'dotenv/config';
import { buildApp } from './app';
import { closeDb, initDb, storageMode } from './db';

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

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`${signal} received, shutting down`);
  try {
    await app.close();
    await closeDb();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
