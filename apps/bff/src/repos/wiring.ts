import type { GithubSourceDeps } from './service';
import type { GithubSourceConfig, ModelProcessManager, RepoFetcher } from './types';

// Where the real fetcher and Model process manager plug into the GitHub source. Until their
// modules land (`fetcher.ts`, `model-process.ts`), placeholders make every analysis fail with a
// readable message. Replace the body of `githubSourceDeps` with the real implementations.

const unavailable = (what: string) => new Error(`${what} is not available in this build of fluid`);

const placeholderFetcher: RepoFetcher = {
  fetch: async () => {
    throw unavailable('Downloading GitHub repositories');
  },
};

const placeholderProcesses: ModelProcessManager = {
  start: async () => {
    throw unavailable('The Model GraphQL server');
  },
  url: () => undefined,
  stop: async () => undefined,
  stopAll: async () => undefined,
};

export function githubSourceDeps(_config: GithubSourceConfig): GithubSourceDeps {
  return { fetcher: placeholderFetcher, processes: placeholderProcesses };
}
