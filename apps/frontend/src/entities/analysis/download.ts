import { z } from 'zod';
import type { SourceFile } from './engine';
import { createSourceAcceptor } from './sourceFilter';
import { rawUrl, treeUrl, type AnalysisRepo } from './repo';

// Reads a repository in the browser. GitHub's tarball host sends no CORS header for other origins,
// so the file list comes from the tree API (one call) and each file from the raw host, a few at a time.

const CONCURRENCY = 12;

const treeSchema = z.object({
  truncated: z.boolean().optional(),
  tree: z.array(z.object({ path: z.string(), type: z.string(), size: z.number().optional() })),
});

const TOO_LARGE = 'This repository is too large to be analysed in the browser.';

/** Why a request failed, in words for the user. */
const httpError = (status: number): string =>
  status === 404
    ? 'Repository not found (only public repositories can be analysed).'
    : status === 403 || status === 429
      ? 'GitHub refused the request (rate limit?). Try again in a few minutes.'
      : `GitHub answered HTTP ${status}.`;

async function get(url: string, signal: AbortSignal, fetchImpl: typeof fetch): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new Error('GitHub cannot be reached.');
  }
  if (!response.ok) throw new Error(httpError(response.status));
  return response;
}

/** Runs `task` on every item, `limit` at a time; the first failure stops the others. */
async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** The files Model can read, with their content. `onProgress(done, total)` after each file. */
export async function downloadSources(
  target: AnalysisRepo,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void = () => undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceFile[]> {
  const listing = treeSchema.parse(await (await get(treeUrl(target), signal, fetchImpl)).json());
  if (listing.truncated) throw new Error(TOO_LARGE);
  const accept = createSourceAcceptor();
  const wanted = listing.tree.filter((e) => e.type === 'blob' && accept(e.path, e.size ?? 1));

  const files: SourceFile[] = [];
  let done = 0;
  await pool(wanted, CONCURRENCY, async (entry) => {
    const response = await get(rawUrl(target, entry.path), signal, fetchImpl);
    files.push({ path: entry.path, data: new Uint8Array(await response.arrayBuffer()) });
    onProgress(++done, wanted.length);
  });
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
