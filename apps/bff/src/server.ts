import { buildApp } from './app';
import { closeDb, initDb, releaseLockSync, storageMode } from './db';

export interface StartServerOptions {
  port: number;
  host: string;
  /** Built frontend directory; unset = API only (or FLUID_STATIC_DIR). */
  staticDir?: string;
  /** SQL migrations directory (PGlite mode); defaults to the source-relative prisma/migrations. */
  migrationsDir?: string;
  logLevel?: string;
}

export interface RunningServer {
  url: string;
  port: number;
  storageLabel: string;
  close: () => Promise<void>;
}

function storageLabel(): string {
  return storageMode.kind === 'pglite' ? `PGlite in ${storageMode.dataDir}` : 'Postgres';
}

/** Opens storage, applies migrations and listens. On any failure, releases everything and rethrows. */
export async function startServer(options: StartServerOptions): Promise<RunningServer> {
  const app = buildApp({ staticDir: options.staticDir, logLevel: options.logLevel });
  const close = async () => {
    try {
      await app.close();
    } finally {
      await closeDb();
    }
  };
  try {
    // Migrations must finish before the first request is served.
    await initDb(options.migrationsDir);
    await app.listen({ port: options.port, host: options.host });
  } catch (err) {
    await close().catch(() => undefined);
    throw err;
  }
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  const label = storageLabel();
  app.log.info(`storage: ${label}`);
  return { url: `http://${options.host}:${port}`, port, storageLabel: label, close };
}

/** Graceful shutdown on SIGINT/SIGTERM/SIGHUP; a second signal force-exits after freeing the lock. */
export function onShutdownSignals(close: () => Promise<void>): void {
  let closing = false;
  const handle = (signal: NodeJS.Signals) => {
    if (closing) {
      releaseLockSync();
      process.exit(130);
    }
    closing = true;
    console.error(`${signal} received, shutting down`);
    setTimeout(() => {
      releaseLockSync();
      process.exit(1);
    }, 10_000).unref();
    close().then(
      () => process.exit(0),
      (err) => {
        console.error(err);
        process.exit(1);
      },
    );
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, handle);
}
