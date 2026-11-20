import { spawn, type ChildProcess } from 'node:child_process';
import type { GithubSourceConfig, ModelProcessManager } from './types';
import {
  LineTail,
  ModelProcessError,
  freePort,
  killProcess,
  redactPaths,
  waitUntilReady,
} from './model-process-support';

export { ModelProcessError } from './model-process-support';

// One `model-graphql` server per repository (badetitou/Model):
//   model-graphql <root> --host 127.0.0.1 --port N --no-scip
// spawned without a shell, on a free port; ready once `{ __typename }` answers on `/graphql`.
// Beyond `maxRunning` servers, the least recently used one is stopped.

export interface ModelProcessOptions {
  /** Extra CLI arguments; default `['--no-scip']`. */
  args?: string[];
  /** How long `start` waits for `/graphql` to answer; default 120 s (indexing a big repo is slow). */
  readyTimeoutMs?: number;
  /** Delay between two readiness probes; default 200 ms. */
  pollIntervalMs?: number;
  /** Delay between SIGTERM and SIGKILL; default 5 s. */
  killGraceMs?: number;
}

/** One server, registered as soon as `start` is called so it can be evicted or stopped at once. */
interface Entry {
  /** Aborted by `stop`, eviction or the caller's signal; the reason is the rejection of `ready`. */
  controller: AbortController;
  ready: Promise<{ graphqlUrl: string }>;
  child?: ChildProcess;
  graphqlUrl?: string;
  isReady: boolean;
  lastUsed: number;
}

const DEFAULT_ARGS = ['--no-scip'];
const STDERR_LINES = 5;
const cancelled = () => new ModelProcessError('The Model server start was cancelled.');
const stopped = () => new ModelProcessError('The Model server was stopped.');

/** Message for a binary that could not be spawned (missing, not executable). */
function spawnFailure(error: NodeJS.ErrnoException): ModelProcessError {
  const reason =
    error.code === 'ENOENT' ? 'was not found' : `could not be started (${error.code ?? 'error'})`;
  return new ModelProcessError(
    `The Model server (model-graphql) ${reason}. Install badetitou/Model and set FLUID_MODEL_GRAPHQL_BIN to its model-graphql binary.`,
  );
}

export function createModelProcessManager(
  config: Pick<GithubSourceConfig, 'modelGraphqlBin' | 'maxRunning'>,
  options: ModelProcessOptions = {},
): ModelProcessManager {
  const args = options.args ?? DEFAULT_ARGS;
  const readyTimeoutMs = options.readyTimeoutMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 200;
  const killGraceMs = options.killGraceMs ?? 5_000;
  const entries = new Map<string, Entry>();
  let clock = 0;
  const touch = (entry: Entry) => (entry.lastUsed = ++clock);
  const forget = (id: string, entry: Entry) => {
    if (entries.get(id) === entry) entries.delete(id);
  };

  /** Removes the entry at once (synchronously), then aborts its start and kills its process. */
  async function stop(id: string): Promise<void> {
    const entry = entries.get(id);
    if (!entry) return;
    entries.delete(id);
    entry.controller.abort(stopped());
    await entry.ready.catch(() => undefined);
    if (entry.child) await killProcess(entry.child, killGraceMs);
  }

  /** Stops the least recently used servers (running or starting) so `keep` fits in `maxRunning`. */
  function makeRoom(keep: string): Promise<unknown> {
    const others = [...entries.entries()].filter(([id]) => id !== keep);
    const excess = others.length - Math.max(config.maxRunning, 1) + 1;
    if (excess <= 0) return Promise.resolve();
    others.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
    return Promise.all(others.slice(0, excess).map(([id]) => stop(id)));
  }

  async function launch(id: string, dir: string, entry: Entry): Promise<{ graphqlUrl: string }> {
    const { signal } = entry.controller;
    const port = await freePort();
    signal.throwIfAborted();
    const graphqlUrl = `http://127.0.0.1:${port}/graphql`;
    const child = spawn(
      config.modelGraphqlBin,
      [dir, '--host', '127.0.0.1', '--port', String(port), ...args],
      { stdio: ['ignore', 'ignore', 'pipe'], shell: false },
    );
    entry.child = child;
    const stderr = new LineTail(50);
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => stderr.push(chunk));

    let failure: ModelProcessError | undefined;
    // `error` (spawn failure) may come without `exit`; `close` comes once stderr is drained.
    // Either way a dead server is forgotten, so the next `start` restarts it.
    child.once('error', (error: NodeJS.ErrnoException) => {
      failure ??= spawnFailure(error);
      forget(id, entry);
    });
    const closed = new Promise<void>((resolve) =>
      child.once('close', (code, sig) => {
        const tail = redactPaths(stderr.last(STDERR_LINES).join('\n'), [
          dir,
          config.modelGraphqlBin,
        ]);
        const how = code !== null ? `exit code ${code}` : `signal ${sig ?? 'unknown'}`;
        failure ??= new ModelProcessError(
          `The Model server stopped (${how})${tail ? `:\n${tail}` : '.'}`,
        );
        forget(id, entry);
        resolve();
      }),
    );

    try {
      const ok = await waitUntilReady(graphqlUrl, () => signal.aborted || failure !== undefined, {
        timeoutMs: readyTimeoutMs,
        intervalMs: pollIntervalMs,
      });
      signal.throwIfAborted();
      if (!ok) {
        // Give `close` a moment so the message carries the last stderr lines.
        await Promise.race([closed, new Promise((r) => setTimeout(r, 500))]);
        throw failure ?? new ModelProcessError('The Model server stopped.');
      }
      entry.graphqlUrl = graphqlUrl;
      entry.isReady = true;
      return { graphqlUrl };
    } catch (error) {
      await killProcess(child, killGraceMs);
      throw error;
    }
  }

  return {
    start(id, dir, startOptions) {
      const signal = startOptions?.signal;
      if (signal?.aborted) return Promise.reject(cancelled());
      const existing = entries.get(id);
      if (existing) {
        touch(existing);
        return existing.ready;
      }
      // Registered before any `await`: concurrent starts see it, evict it or stop it.
      const controller = new AbortController();
      const entry: Entry = {
        controller,
        ready: Promise.resolve({ graphqlUrl: '' }),
        isReady: false,
        lastUsed: 0,
      };
      entries.set(id, entry);
      touch(entry);
      const onAbort = () => controller.abort(cancelled());
      signal?.addEventListener('abort', onAbort, { once: true });
      const room = makeRoom(id);
      entry.ready = (async () => {
        await room;
        return launch(id, dir, entry);
      })()
        .catch((error: unknown) => {
          forget(id, entry);
          throw error;
        })
        .finally(() => signal?.removeEventListener('abort', onAbort));
      return entry.ready;
    },

    url(id) {
      const entry = entries.get(id);
      if (!entry?.isReady) return undefined;
      touch(entry);
      return entry.graphqlUrl;
    },

    stop,

    async stopAll() {
      await Promise.all([...entries.keys()].map((id) => stop(id)));
    },
  };
}
