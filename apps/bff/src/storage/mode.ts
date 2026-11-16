import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

// Empty strings (e.g. `DATABASE_URL=` in a .env) count as unset.
const optionalString = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const envSchema = z.object({
  DATABASE_URL: optionalString,
  FLUID_DATA_DIR: optionalString,
});

export type StorageMode =
  | { kind: 'postgres'; url: string; schema?: string }
  | { kind: 'pglite'; dataDir: string };

/** Expands a leading `~` and makes the path absolute; `memory://` is kept as is. */
export function normalizeDataDir(dir: string, home = homedir()): string {
  if (dir.startsWith('memory://')) return dir;
  if (dir === '~') return resolve(home);
  if (dir.startsWith('~/')) return resolve(home, dir.slice(2));
  return resolve(dir);
}

/** Postgres when DATABASE_URL is set, embedded PGlite otherwise. */
export function resolveStorageMode(env: Record<string, string | undefined>): StorageMode {
  const { DATABASE_URL, FLUID_DATA_DIR } = envSchema.parse(env);
  if (DATABASE_URL) {
    // The `pg` adapter ignores the `?schema=` URL parameter, so it is forwarded explicitly.
    const schema = new URL(DATABASE_URL).searchParams.get('schema') ?? undefined;
    return { kind: 'postgres', url: DATABASE_URL, schema };
  }
  return { kind: 'pglite', dataDir: normalizeDataDir(FLUID_DATA_DIR ?? join(homedir(), '.fluid', 'data')) };
}
