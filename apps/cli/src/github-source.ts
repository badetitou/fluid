import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

// The GitHub source (analyse a public repository with badetitou/Model) needs `model-graphql`, which
// npm cannot ship (Rust, no prebuilt binary). The CLI turns the source on when it finds the binary:
// --model-graphql > FLUID_MODEL_GRAPHQL_BIN > PATH > ~/.cargo/bin. --no-github (or
// FLUID_REPOS_ENABLED=false) turns it off; FLUID_REPOS_ENABLED=true keeps it on without a binary.

type Env = Record<string, string | undefined>;

export const MODEL_GRAPHQL_INSTALL = 'cargo install model-graphql --version 0.4.0 --locked';

export interface GithubSourceOptions {
  github: boolean;
  modelGraphql?: string;
}

export interface GithubSource {
  enabled: boolean;
  /** Variables for the BFF; empty when it is off. */
  env: { FLUID_REPOS_ENABLED?: string; FLUID_MODEL_GRAPHQL_BIN?: string };
  /** One line for the startup log. */
  message: string;
}

const isExecutable = (file: string): boolean => {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const BIN = process.platform === 'win32' ? 'model-graphql.exe' : 'model-graphql';

/** Candidate paths for `model-graphql`, most explicit first. */
export function modelGraphqlCandidates(opts: GithubSourceOptions, env: Env, home = homedir()): string[] {
  if (opts.modelGraphql) return [opts.modelGraphql];
  if (env.FLUID_MODEL_GRAPHQL_BIN) return [env.FLUID_MODEL_GRAPHQL_BIN];
  const fromPath = (env.PATH ?? '').split(delimiter).filter(Boolean).map((dir) => join(dir, BIN));
  return [...fromPath, join(home, '.cargo', 'bin', BIN)];
}

export function resolveGithubSource(
  opts: GithubSourceOptions,
  env: Env,
  exists: (file: string) => boolean = isExecutable,
): GithubSource {
  const off = (message: string): GithubSource => ({ enabled: false, env: {}, message });
  if (!opts.github || env.FLUID_REPOS_ENABLED === 'false') return off('GitHub source: off');
  const candidates = modelGraphqlCandidates(opts, env);
  const bin = candidates.find(exists);
  if (bin) {
    return { enabled: true, env: { FLUID_REPOS_ENABLED: 'true', FLUID_MODEL_GRAPHQL_BIN: bin }, message: `GitHub source: on (${bin})` };
  }
  if (opts.modelGraphql) return off(`GitHub source: off, --model-graphql ${opts.modelGraphql} is not an executable`);
  if (env.FLUID_REPOS_ENABLED === 'true') {
    return { enabled: true, env: { FLUID_REPOS_ENABLED: 'true' }, message: 'GitHub source: on, but model-graphql was not found' };
  }
  return off(`GitHub source: off (model-graphql not found; install it with \`${MODEL_GRAPHQL_INSTALL}\`)`);
}
