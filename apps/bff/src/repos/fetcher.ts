import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import { githubRefSchema, githubRepoNameSchema } from '@fluid/shared';
import { extractTar } from './extract';
import { RepoFetchError } from './fetch-error';
import type { RepoFetcher } from './types';

export { RepoFetchError } from './fetch-error';

/** Extracted files may weigh this many times the download limit (guards against gzip bombs). */
export const EXTRACTED_SIZE_FACTOR = 20;

export interface RepoFetcherDeps {
  fetch?: typeof fetch;
  /** Read for `GITHUB_TOKEN` at each download; defaults to `process.env`. */
  env?: Record<string, string | undefined>;
}

/** The codeload URL of a repository tarball; validates `repo` and `ref`. */
export function codeloadUrl(repo: string, ref?: string): string {
  if (!githubRepoNameSchema.safeParse(repo).success) throw new RepoFetchError('Expected owner/name');
  if (ref !== undefined && !githubRefSchema.safeParse(ref).success) throw new RepoFetchError('Invalid ref');
  const [owner, name] = repo.split('/');
  const refPath = (ref ?? 'HEAD').split('/').map(encodeURIComponent).join('/');
  return `https://codeload.github.com/${owner}/${name}/tar.gz/${refPath}`;
}

const TOO_LARGE = 'Repository archive is larger than the download limit';

/** Passes chunks through, failing as soon as more than `maxBytes` went by. */
function limitBytes(maxBytes: number, message: string) {
  return async function* (source: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
    let seen = 0;
    for await (const chunk of source) {
      seen += chunk.length;
      if (seen > maxBytes) throw new RepoFetchError(message);
      yield chunk;
    }
  };
}

async function download(
  url: string,
  deps: Required<RepoFetcherDeps>,
  signal: AbortSignal | undefined,
  maxBytes: number,
): Promise<Response> {
  const token = deps.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { 'user-agent': 'fluid' };
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await deps.fetch(url, { headers, signal, redirect: 'follow' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new RepoFetchError('Could not reach GitHub', { cause: error });
  }
  if (res.status === 404) {
    await res.body?.cancel().catch(() => undefined);
    throw new RepoFetchError('Repository not found or not public');
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    throw new RepoFetchError(`Download failed (HTTP ${res.status})`);
  }
  const length = Number(res.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) {
    await res.body.cancel().catch(() => undefined);
    throw new RepoFetchError(TOO_LARGE);
  }
  return res;
}

/** Keeps safe messages, hides the rest (fs errors carry server paths). Aborts are rethrown as is. */
function readable(error: unknown, signal: AbortSignal | undefined): unknown {
  if (signal?.aborted) return signal.reason ?? error;
  if (error instanceof RepoFetchError) return error;
  if (error instanceof Error && 'code' in error && String(error.code).startsWith('Z_')) {
    return new RepoFetchError('Downloaded archive is not a valid tar.gz', { cause: error });
  }
  return new RepoFetchError('Could not extract the repository', { cause: error });
}

/** Downloads public repositories from codeload.github.com (see {@link RepoFetcher}). */
export function createRepoFetcher(deps: RepoFetcherDeps = {}): RepoFetcher {
  const resolved: Required<RepoFetcherDeps> = { fetch: deps.fetch ?? fetch, env: deps.env ?? process.env };
  return {
    async fetch({ repo, ref, destDir }, { signal, maxBytes }) {
      const url = codeloadUrl(repo, ref);
      const dir = path.resolve(destDir);
      if (dir === path.parse(dir).root) throw new RepoFetchError('Refusing to extract into the filesystem root');
      signal?.throwIfAborted();
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      try {
        const res = await download(url, resolved, signal, maxBytes);
        const body = Readable.fromWeb(res.body as NodeReadableStream<Uint8Array>);
        await pipeline(
          body,
          limitBytes(maxBytes, TOO_LARGE),
          createGunzip(),
          // Counts every decompressed byte, including entries the extractor skips.
          limitBytes(maxBytes * EXTRACTED_SIZE_FACTOR, 'Repository is too large'),
          (source: AsyncIterable<Buffer>) =>
            extractTar(source, dir, { maxBytes: maxBytes * EXTRACTED_SIZE_FACTOR, signal }),
          { signal },
        );
      } catch (error) {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
        throw readable(error, signal);
      }
      return { dir };
    },
  };
}
