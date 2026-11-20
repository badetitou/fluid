import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { githubRepoId, type AddGithubRepoBody, type GithubRepo, type GithubRepoStatus } from '@fluid/shared';
import type { GraphqlBody } from '../sources/model';
import { forwardGraphql, type ProxyResult } from '../sources/proxy';
import type { GithubSourceConfig, ModelProcessManager, RepoFetcher } from './types';

// The GitHub source: one in-memory entry per repository id, analysed by a background job
// (queued → downloading → analyzing → ready | failed), and the GraphQL proxy to its Model server.

export interface GithubSourceDeps {
  fetcher: RepoFetcher;
  processes: ModelProcessManager;
  /** Proxy used for `/graphql`; defaults to `forwardGraphql` (tests inject a fake). */
  forward?: (url: string, body: GraphqlBody) => Promise<ProxyResult>;
  now?: () => Date;
}

export interface GithubSource {
  /** Idempotent on id: an existing entry is returned as is, a failed one is analysed again. */
  add(body: AddGithubRepoBody): GithubRepo;
  list(): GithubRepo[];
  get(id: string): GithubRepo | undefined;
  /** Stops the job and the process, removes the files; false when the id is unknown. */
  remove(id: string): Promise<boolean>;
  /** null when the id is unknown; `409` when the repository is not ready. */
  runGraphql(id: string, body: GraphqlBody): Promise<ProxyResult | null>;
  /** Waits for the background job of `id` (tests, shutdown). */
  settled(id: string): Promise<void>;
  stopAll(): Promise<void>;
}

interface Entry {
  repo: GithubRepo;
  dir: string;
  abort: AbortController;
  job: Promise<void>;
  /** In-flight restart of a ready repository whose server was stopped (LRU). */
  restart?: Promise<string>;
}

const MAX_ERROR_LENGTH = 500;

/** The message of a failure, without server paths, capped. */
export function publicError(err: unknown, config: Pick<GithubSourceConfig, 'reposDir'>, home = homedir()): string {
  const raw = err instanceof Error ? err.message : String(err);
  const clean = raw.split(config.reposDir).join('<repos>').split(home).join('~').trim();
  return (clean || 'Analysis failed').slice(0, MAX_ERROR_LENGTH);
}

const isAbort = (err: unknown) => err instanceof Error && err.name === 'AbortError';

/** Trusted loopback URLs from the process manager: no host policy (FLUID_BLOCK_PRIVATE_HOSTS would refuse 127.0.0.1). */
const allowLoopback = async () => undefined;
const defaultForward = (url: string, body: GraphqlBody) => forwardGraphql(url, {}, body, { hostCheck: allowLoopback });

const conflict = (status: GithubRepoStatus): ProxyResult => ({
  status: 409,
  body: { errors: [{ message: `Repository is not ready (status: ${status})` }] },
});

export function createGithubSource(config: GithubSourceConfig, deps: GithubSourceDeps): GithubSource {
  const { fetcher, processes, forward = defaultForward, now = () => new Date() } = deps;
  const entries = new Map<string, Entry>();

  const setStatus = (entry: Entry, status: GithubRepoStatus, error?: string) => {
    const { error: _previous, ...rest } = entry.repo;
    entry.repo = { ...rest, status, ...(error ? { error } : {}), updatedAt: now().toISOString() };
  };

  async function analyse(entry: Entry): Promise<void> {
    const { signal } = entry.abort;
    const { repo, ref } = entry.repo;
    try {
      setStatus(entry, 'downloading');
      const { dir } = await fetcher.fetch(
        { repo, ...(ref ? { ref } : {}), destDir: entry.dir },
        { signal, maxBytes: config.maxBytes },
      );
      entry.dir = dir;
      signal.throwIfAborted();
      setStatus(entry, 'analyzing');
      await processes.start(entry.repo.id, dir, { signal });
      signal.throwIfAborted();
      setStatus(entry, 'ready');
    } catch (err) {
      if (signal.aborted || isAbort(err)) return; // removed or shutting down: the entry is gone
      setStatus(entry, 'failed', publicError(err, config));
    }
  }

  function launch(entry: Entry) {
    entry.abort = new AbortController();
    // Analysis starts on the next tick so `add` answers `queued` first.
    entry.job = Promise.resolve().then(() => analyse(entry));
  }

  /** URL of the server of a ready repository, restarting it when the manager stopped it. */
  async function serverUrl(entry: Entry): Promise<string> {
    const running = processes.url(entry.repo.id);
    if (running) return running;
    entry.restart ??= processes
      .start(entry.repo.id, entry.dir, { signal: entry.abort.signal })
      .then((r) => r.graphqlUrl)
      .finally(() => {
        entry.restart = undefined;
      });
    return entry.restart;
  }

  return {
    add({ repo, ref }) {
      const id = githubRepoId(repo, ref);
      const existing = entries.get(id);
      if (existing && existing.repo.status !== 'failed') return existing.repo;
      const entry: Entry = existing ?? {
        repo: { id, repo, ...(ref ? { ref } : {}), status: 'queued', updatedAt: '', graphqlPath: `/api/github-repos/${id}/graphql` },
        dir: join(config.reposDir, id),
        abort: new AbortController(),
        job: Promise.resolve(),
      };
      setStatus(entry, 'queued');
      entries.set(id, entry);
      launch(entry);
      return entry.repo;
    },

    list: () => [...entries.values()].map((e) => e.repo),

    get: (id) => entries.get(id)?.repo,

    async remove(id) {
      const entry = entries.get(id);
      if (!entry) return false;
      entries.delete(id);
      entry.abort.abort();
      await entry.job;
      await processes.stop(id);
      await rm(join(config.reposDir, id), { recursive: true, force: true });
      return true;
    },

    async runGraphql(id, body) {
      const entry = entries.get(id);
      if (!entry) return null;
      if (entry.repo.status !== 'ready') return conflict(entry.repo.status);
      let url: string;
      try {
        url = await serverUrl(entry);
      } catch (err) {
        if (!entries.has(id)) return null;
        return { status: 502, body: { errors: [{ message: publicError(err, config) }] } };
      }
      return forward(url, body);
    },

    settled: async (id) => {
      await entries.get(id)?.job;
    },

    async stopAll() {
      const all = [...entries.values()];
      for (const entry of all) entry.abort.abort();
      await Promise.all(all.map((e) => e.job));
      await processes.stopAll();
    },
  };
}
