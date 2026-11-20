import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { normalizeDataDir } from '../storage/mode';
import type { GithubSourceConfig } from './types';

// Reads the GitHub source configuration from the environment (defaults documented in `types.ts`).

const MIB = 1024 * 1024;

// Empty strings (e.g. `FLUID_REPOS_DIR=` in a .env) count as unset.
const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);
const positiveInt = (fallback: number) =>
  optional
    .refine((v) => v === undefined || /^[1-9]\d*$/.test(v))
    .transform((v) => (v === undefined ? fallback : Number(v)));

const envSchema = z.object({
  FLUID_MODEL_GRAPHQL_BIN: optional,
  FLUID_REPOS_DIR: optional,
  FLUID_DATA_DIR: optional,
  FLUID_REPOS_MAX_RUNNING: positiveInt(3),
  FLUID_REPOS_MAX_BYTES: positiveInt(200 * MIB),
  FLUID_REPOS_ENABLED: optional,
});

/** Throws a readable error when a numeric variable is not a positive integer. */
export function readGithubSourceConfig(env: Record<string, string | undefined>, home = homedir()): GithubSourceConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid GitHub source configuration: ${keys} must be a positive integer`);
  }
  const e = parsed.data;
  const dataDir = e.FLUID_DATA_DIR && !e.FLUID_DATA_DIR.startsWith('memory://')
    ? normalizeDataDir(e.FLUID_DATA_DIR, home)
    : join(home, '.fluid', 'data');
  return {
    modelGraphqlBin: e.FLUID_MODEL_GRAPHQL_BIN ?? 'model-graphql',
    reposDir: e.FLUID_REPOS_DIR ? normalizeDataDir(e.FLUID_REPOS_DIR, home) : join(dataDir, 'repos'),
    maxRunning: e.FLUID_REPOS_MAX_RUNNING,
    maxBytes: e.FLUID_REPOS_MAX_BYTES,
    enabled: ['1', 'true'].includes((e.FLUID_REPOS_ENABLED ?? '').toLowerCase()),
  };
}
