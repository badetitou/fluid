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

interface Entry {
  child: ChildProcess;
  graphqlUrl: string;
  isReady: boolean;
  lastUsed: number;
}

const DEFAULT_ARGS = ['--no-scip'];
const STDERR_LINES = 5;

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
  /** Starts in progress, so concurrent `start` calls on one id share a single process. */
  const starting = new Map<string, Promise<{ graphqlUrl: string }>>();
  let clock = 0;
  const touch = (entry: Entry) => (entry.lastUsed = ++clock);

  async function stop(id: string): Promise<void> {
    const entry = entries.get(id);
    if (!entry) return;
    entries.delete(id);
    await killProcess(entry.child, killGraceMs);
  }

  /** Stops the least recently used servers until there is room for one more. */
  async function makeRoom(keep: string): Promise<void> {
    const others = [...entries.entries()].filter(([id]) => id !== keep);
    const pendingOthers = [...starting.keys()].filter(
      (id) => id !== keep && !entries.has(id),
    ).length;
    const excess = others.length + pendingOthers - Math.max(config.maxRunning, 1) + 1;
    if (excess <= 0) return;
    others.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
    await Promise.all(others.slice(0, excess).map(([id]) => stop(id)));
  }

  async function launch(
    id: string,
    dir: string,
    signal: AbortSignal | undefined,
  ): Promise<{ graphqlUrl: string }> {
    const port = await freePort();
    if (signal?.aborted) throw new ModelProcessError('The Model server start was cancelled.');
    const graphqlUrl = `http://127.0.0.1:${port}/graphql`;
    const child = spawn(
      config.modelGraphqlBin,
      [dir, '--host', '127.0.0.1', '--port', String(port), ...args],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
        shell: false,
      },
    );
    const stderr = new LineTail(50);
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => stderr.push(chunk));

    let failure: ModelProcessError | undefined;
    let aborted = false;
    const forget = () => {
      if (entries.get(id)?.child === child) entries.delete(id);
    };
    // `error` (spawn failure) may come without `exit`; `close` comes once stderr is drained.
    child.once('error', (error: NodeJS.ErrnoException) => {
      failure ??= spawnFailure(error);
      forget();
    });
    const exit = new Promise<void>((resolve) =>
      child.once('close', (code, sig) => {
        const tail = redactPaths(stderr.last(STDERR_LINES).join('\n'), [
          dir,
          config.modelGraphqlBin,
        ]);
        const how = code !== null ? `exit code ${code}` : `signal ${sig ?? 'unknown'}`;
        failure ??= new ModelProcessError(
          `The Model server stopped (${how})${tail ? `:\n${tail}` : '.'}`,
        );
        forget();
        resolve();
      }),
    );

    const onAbort = () => {
      aborted = true;
      void stop(id);
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const entry: Entry = { child, graphqlUrl, isReady: false, lastUsed: 0 };
    entries.set(id, entry);
    touch(entry);
    try {
      const ok = await waitUntilReady(graphqlUrl, () => aborted || failure !== undefined, {
        timeoutMs: readyTimeoutMs,
        intervalMs: pollIntervalMs,
      });
      if (aborted) throw new ModelProcessError('The Model server start was cancelled.');
      if (!ok) {
        // Give `close` a moment so the message carries the last stderr lines.
        await Promise.race([exit, new Promise((r) => setTimeout(r, 500))]);
        throw failure ?? new ModelProcessError('The Model server stopped.');
      }
      entry.isReady = true;
      return { graphqlUrl };
    } catch (error) {
      if (entries.get(id) === entry) entries.delete(id);
      await killProcess(child, killGraceMs);
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    async start(id, dir, startOptions) {
      const signal = startOptions?.signal;
      if (signal?.aborted) throw new ModelProcessError('The Model server start was cancelled.');
      const pending = starting.get(id);
      if (pending) return pending;
      const existing = entries.get(id);
      if (existing?.isReady) {
        touch(existing);
        return { graphqlUrl: existing.graphqlUrl };
      }
      const ready = (async () => {
        await makeRoom(id);
        return launch(id, dir, signal);
      })().finally(() => starting.delete(id));
      starting.set(id, ready);
      return ready;
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
