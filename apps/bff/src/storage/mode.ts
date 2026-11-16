import { homedir } from 'node:os';
import { join } from 'node:path';
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

/** Postgres when DATABASE_URL is set, embedded PGlite otherwise. */
export function resolveStorageMode(env: Record<string, string | undefined>): StorageMode {
  const { DATABASE_URL, FLUID_DATA_DIR } = envSchema.parse(env);
  if (DATABASE_URL) {
    // The `pg` adapter ignores the `?schema=` URL parameter, so it is forwarded explicitly.
    const schema = new URL(DATABASE_URL).searchParams.get('schema') ?? undefined;
    return { kind: 'postgres', url: DATABASE_URL, schema };
  }
  return { kind: 'pglite', dataDir: FLUID_DATA_DIR ?? join(homedir(), '.fluid', 'data') };
}
