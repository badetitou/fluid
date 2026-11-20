import { createRepoFetcher } from './fetcher';
import { createModelProcessManager } from './model-process';
import type { GithubSourceDeps } from './service';
import type { GithubSourceConfig } from './types';

// Where the real fetcher and Model process manager plug into the GitHub source.

export function githubSourceDeps(config: GithubSourceConfig): GithubSourceDeps {
  return { fetcher: createRepoFetcher(), processes: createModelProcessManager(config) };
}
