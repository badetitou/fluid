import type { GithubSourceConfig, ModelProcessManager, RepoFetcher } from './types';

// Fakes of the fetcher and the Model process manager for the GitHub source tests.

export const testConfig = (reposDir: string): GithubSourceConfig => ({
  modelGraphqlBin: 'model-graphql',
  reposDir,
  maxRunning: 3,
  maxBytes: 1000,
  enabled: true,
});

/** A promise resolved from outside, to hold a fake step until the test releases it. */
export function gate() {
  let open!: () => void;
  const promise = new Promise<void>((r) => (open = r));
  return { promise, open };
}

const abortable = (signal: AbortSignal | undefined, wait: Promise<void>) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    void wait.then(resolve);
  });

export class FakeFetcher implements RepoFetcher {
  calls: { repo: string; ref?: string; destDir: string; maxBytes: number }[] = [];
  hold?: Promise<void>;
  failWith?: Error;

  async fetch(request: { repo: string; ref?: string; destDir: string }, options: { signal?: AbortSignal; maxBytes: number }) {
    this.calls.push({ ...request, maxBytes: options.maxBytes });
    if (this.hold) await abortable(options.signal, this.hold);
    if (this.failWith) throw this.failWith;
    return { dir: request.destDir };
  }
}

export class FakeProcesses implements ModelProcessManager {
  running = new Map<string, string>();
  starts: { id: string; dir: string }[] = [];
  stopped: string[] = [];
  stoppedAll = false;
  hold?: Promise<void>;
  failWith?: Error;

  async start(id: string, dir: string, options?: { signal?: AbortSignal }) {
    this.starts.push({ id, dir });
    if (this.hold) await abortable(options?.signal, this.hold);
    if (this.failWith) throw this.failWith;
    const graphqlUrl = `http://127.0.0.1:9${this.starts.length}/graphql`;
    this.running.set(id, graphqlUrl);
    return { graphqlUrl };
  }
  url(id: string) {
    return this.running.get(id);
  }
  async stop(id: string) {
    this.stopped.push(id);
    this.running.delete(id);
  }
  async stopAll() {
    this.stoppedAll = true;
    this.running.clear();
  }
}
