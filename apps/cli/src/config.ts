import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliOptions } from './args';
import { resolveGithubSource } from './github-source';

export interface RunConfig {
  port: number;
  host: string;
  /** Where the user can reach the server (wildcard addresses become localhost). */
  displayUrl: (port: number) => string;
  /** Variables the CLI sets: where PGlite keeps its data, and the GitHub source when model-graphql is found. */
  envOverrides: { FLUID_DATA_DIR: string; FLUID_REPOS_ENABLED?: string; FLUID_MODEL_GRAPHQL_BIN?: string };
  /** One line about the GitHub source, for the startup log. */
  githubSource: string;
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
  const github = resolveGithubSource(opts, env);
  const shown = WILDCARDS.has(opts.host) ? 'localhost' : opts.host.includes(':') ? `[${opts.host}]` : opts.host;
  return {
    port: opts.port,
    host: opts.host,
    displayUrl: (port) => `http://${shown}:${port}`,
    envOverrides: { FLUID_DATA_DIR: dataDir, ...github.env },
    githubSource: github.message,
    postgres,
    warnings,
  };
}
