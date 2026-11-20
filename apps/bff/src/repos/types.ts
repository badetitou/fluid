// Interfaces between the three BFF pieces of the GitHub source, so they are built in parallel:
// the fetcher (download + extract), the Model process manager (one `model-graphql` per repository)
// and the service/routes that orchestrate them. Each implementation lives in its own module.

/** Downloads a public GitHub repository and extracts it into `destDir` (created, emptied first). */
export interface RepoFetcher {
  fetch(
    request: { repo: string; ref?: string; destDir: string },
    options: { signal?: AbortSignal; maxBytes: number },
  ): Promise<{ dir: string }>;
}

/** Runs one `model-graphql` server per repository, on 127.0.0.1 and a free port. */
export interface ModelProcessManager {
  /** Starts the server on `dir` and resolves once `/graphql` answers; rejects with a readable message. */
  start(id: string, dir: string, options?: { signal?: AbortSignal }): Promise<{ graphqlUrl: string }>;
  /** The GraphQL URL of a running server, if any. */
  url(id: string): string | undefined;
  stop(id: string): Promise<void>;
  stopAll(): Promise<void>;
}

/** Runtime configuration (env), read once by the BFF. */
export interface GithubSourceConfig {
  /** `FLUID_MODEL_GRAPHQL_BIN`, default `model-graphql` on PATH. */
  modelGraphqlBin: string;
  /** `FLUID_REPOS_DIR`, default `<data dir>/repos`. */
  reposDir: string;
  /** `FLUID_REPOS_MAX_RUNNING`, default 3: older servers are stopped (LRU) beyond it. */
  maxRunning: number;
  /** `FLUID_REPOS_MAX_BYTES`, default 200 MiB: download size limit. */
  maxBytes: number;
  /** `FLUID_REPOS_ENABLED`, default false: the routes are not registered otherwise. */
  enabled: boolean;
}
