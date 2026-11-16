import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliOptions } from './args';

export interface RunConfig {
  port: number;
  host: string;
  /** Where the user can reach the server (wildcard addresses become localhost). */
  displayUrl: (port: number) => string;
  /** The only variable the CLI sets: where PGlite keeps its data. */
  envOverrides: { FLUID_DATA_DIR: string };
  postgres: boolean;
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const WILDCARDS = new Set(['0.0.0.0', '::', '[::]']);

/** Flag > FLUID_DATA_DIR > ~/.fluid/data. PORT and HOST are deliberately never read. */
export function resolveRunConfig(opts: CliOptions, env: Env): RunConfig {
  const postgres = Boolean(env.DATABASE_URL);
  const warnings: string[] = [];
  if (postgres && opts.dataDir) warnings.push('--data-dir ignored: DATABASE_URL is set');
  const dataDir = opts.dataDir || env.FLUID_DATA_DIR || join(homedir(), '.fluid', 'data');
  const shown = WILDCARDS.has(opts.host) ? 'localhost' : opts.host.includes(':') ? `[${opts.host}]` : opts.host;
  return {
    port: opts.port,
    host: opts.host,
    displayUrl: (port) => `http://${shown}:${port}`,
    envOverrides: { FLUID_DATA_DIR: dataDir },
    postgres,
    warnings,
  };
}
