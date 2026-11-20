import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

// Helpers of the Model process manager (`model-process.ts`): free port, readiness probe, kill,
// and a stderr tail that never leaks a server path to the client.

/** A readable failure of a `model-graphql` server, safe to show to the client. */
export class ModelProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelProcessError';
  }
}

/** Asks the OS for a free TCP port on 127.0.0.1. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error('No free port'))));
    });
  });
}

/** One `{ __typename }` query; true when the server answers with GraphQL data. */
export async function graphqlAnswers(url: string, timeoutMs = 2_000): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && 'data' in body;
  } catch {
    return false;
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Polls `url` until it answers. Stops early (returns false) as soon as `stopped()` is true, e.g.
 * because the process exited or the start was aborted; throws once `timeoutMs` is spent.
 */
export async function waitUntilReady(
  url: string,
  stopped: () => boolean,
  options: { timeoutMs: number; intervalMs: number },
): Promise<boolean> {
  const deadline = Date.now() + options.timeoutMs;
  while (!stopped()) {
    if (await graphqlAnswers(url)) return !stopped();
    if (Date.now() >= deadline) {
      throw new ModelProcessError(
        `The Model server did not answer within ${Math.round(options.timeoutMs / 1000)} s.`,
      );
    }
    await delay(options.intervalMs);
  }
  return false;
}

const hasExited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

const exited = (child: ChildProcess, timeoutMs: number) =>
  new Promise<boolean>((resolve) => {
    if (hasExited(child)) return resolve(true);
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

/** SIGTERM, then SIGKILL if the process is still alive after `graceMs`. */
export async function killProcess(child: ChildProcess, graceMs: number): Promise<void> {
  if (hasExited(child) || child.pid === undefined) return;
  child.kill('SIGTERM');
  if (await exited(child, graceMs)) return;
  child.kill('SIGKILL');
  await exited(child, graceMs);
}

/** Keeps the last lines written to a stream. */
export class LineTail {
  private lines: string[] = [];
  private partial = '';

  constructor(private readonly max: number) {}

  push(chunk: string): void {
    const parts = (this.partial + chunk).split(/\r?\n/);
    this.partial = parts.pop() ?? '';
    this.lines.push(...parts.filter((line) => line.trim() !== ''));
    if (this.lines.length > this.max) this.lines = this.lines.slice(-this.max);
  }

  last(count: number): string[] {
    const all = this.partial.trim() ? [...this.lines, this.partial] : this.lines;
    return all.slice(-count);
  }
}

const ABSOLUTE_PATH = /(?:[A-Za-z]:)?(?:[\\/][\w.@+~-]+){2,}[\\/]?/g;

/** Removes server paths from a message: the repository dir, the binary, any absolute path. */
export function redactPaths(text: string, known: string[]): string {
  let out = text;
  for (const path of known.filter((p) => p.length > 1)) out = out.split(path).join('<repo>');
  return out.replace(ABSOLUTE_PATH, '<path>');
}
