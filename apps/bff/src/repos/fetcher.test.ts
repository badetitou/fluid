import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { codeloadUrl, createRepoFetcher, RepoFetchError } from './fetcher';
import { makeTarGz } from './tar-fixture';

let work: string;
let destDir: string;
beforeEach(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'fluid-fetcher-'));
  destDir = path.join(work, 'repo');
});
afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

const archive = makeTarGz([
  { path: 'pax_global_header', type: 'paxGlobal', content: '52 comment=0123456789012345678901234567890123456789\n' },
  { path: 'Model-abc/', type: 'directory' },
  { path: 'Model-abc/src/A.st', content: 'Object subclass: #A' },
]);

interface Call {
  url: string;
  init?: RequestInit;
}

function fakeFetch(make: () => Response, calls: Call[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return make();
  }) as typeof fetch;
}

/** A body sent in chunks, without Content-Length. */
function streamed(data: Buffer, chunk = 64): Response {
  let pos = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pos >= data.length) return controller.close();
      controller.enqueue(new Uint8Array(data.subarray(pos, pos + chunk)));
      pos += chunk;
    },
  });
  return new Response(body);
}

const opts = { maxBytes: 1_000_000 };

describe('codeloadUrl', () => {
  it('builds the codeload URL, HEAD by default', () => {
    expect(codeloadUrl('badetitou/Model')).toBe('https://codeload.github.com/badetitou/Model/tar.gz/HEAD');
    expect(codeloadUrl('a/b', 'feature/x')).toBe('https://codeload.github.com/a/b/tar.gz/feature/x');
  });

  it.each([['nope'], ['a/b/c'], ['../x'], ['a/..']])('rejects the repository %s', (repo) => {
    expect(() => codeloadUrl(repo)).toThrow(RepoFetchError);
  });

  it.each([['..'], ['a b'], ['x?y']])('rejects the ref %s', (ref) => {
    expect(() => codeloadUrl('a/b', ref)).toThrow('Invalid ref');
  });
});

describe('createRepoFetcher', () => {
  it('downloads and extracts into an emptied destDir, without token header when none is set', async () => {
    await mkdir(destDir, { recursive: true });
    await writeFile(path.join(destDir, 'stale.txt'), 'old');
    const calls: Call[] = [];
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => streamed(archive), calls), env: {} });
    const { dir } = await fetcher.fetch({ repo: 'badetitou/Model', ref: 'v1.0', destDir }, opts);
    expect(dir).toBe(destDir);
    expect(await readdir(dir)).toEqual(['src']);
    expect(await readFile(path.join(dir, 'src/A.st'), 'utf8')).toBe('Object subclass: #A');
    expect(calls[0]?.url).toBe('https://codeload.github.com/badetitou/Model/tar.gz/v1.0');
    expect(calls[0]?.init?.headers).not.toHaveProperty('authorization');
  });

  it('sends GITHUB_TOKEN when set', async () => {
    const calls: Call[] = [];
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => streamed(archive), calls), env: { GITHUB_TOKEN: 't0k' } });
    await fetcher.fetch({ repo: 'a/b', destDir }, opts);
    expect(calls[0]?.init?.headers).toMatchObject({ authorization: 'Bearer t0k' });
  });

  it('validates the input before downloading', async () => {
    const calls: Call[] = [];
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => streamed(archive), calls), env: {} });
    await expect(fetcher.fetch({ repo: 'not a repo', destDir }, opts)).rejects.toThrow('owner/name');
    expect(calls).toHaveLength(0);
  });

  it('reports a missing or private repository', async () => {
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => new Response('Not Found', { status: 404 })), env: {} });
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, opts)).rejects.toThrow('Repository not found or not public');
  });

  it('reports other HTTP failures', async () => {
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => new Response('', { status: 503 })), env: {} });
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, opts)).rejects.toThrow('HTTP 503');
  });

  it('aborts beyond maxBytes counting streamed bytes, and cleans destDir', async () => {
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => streamed(archive, 16)), env: {} });
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, { maxBytes: archive.length - 1 })).rejects.toThrow(
      'larger than the download limit',
    );
    await expect(readdir(destDir)).rejects.toThrow();
  });

  it('refuses early on a Content-Length above maxBytes', async () => {
    const big = () => new Response(archive, { headers: { 'content-length': String(archive.length) } });
    const fetcher = createRepoFetcher({ fetch: fakeFetch(big), env: {} });
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, { maxBytes: 10 })).rejects.toThrow('download limit');
  });

  it('reports an archive that is not a tar.gz', async () => {
    const fetcher = createRepoFetcher({ fetch: fakeFetch(() => streamed(Buffer.from('<html>nope</html>'))), env: {} });
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, opts)).rejects.toThrow('not a valid tar.gz');
  });

  it('honours the abort signal, passing it to fetch', async () => {
    const controller = new AbortController();
    const calls: Call[] = [];
    let pos = 0;
    const slow = () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(c) {
            if (pos === 32) controller.abort(new Error('cancelled'));
            if (pos >= archive.length) return c.close();
            c.enqueue(new Uint8Array(archive.subarray(pos, pos + 16)));
            pos += 16;
          },
        }),
      );
    const fetcher = createRepoFetcher({ fetch: fakeFetch(slow, calls), env: {} });
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, { ...opts, signal: controller.signal })).rejects.toThrow(
      'cancelled',
    );
    expect(calls[0]?.init?.signal).toBe(controller.signal);
    await expect(fetcher.fetch({ repo: 'a/b', destDir }, { ...opts, signal: controller.signal })).rejects.toThrow(
      'cancelled',
    );
  });
});
