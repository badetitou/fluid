import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffUnreachable, githubReposApi } from './githubReposApi';

const signal = new AbortController().signal;
const repo = {
  id: 'a--b',
  repo: 'a/b',
  status: 'queued',
  updatedAt: '2026-11-20T10:00:00Z',
  graphqlPath: '/api/github-repos/a--b/graphql',
};

const answer = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe('githubReposApi', () => {
  it('lists the validated repositories', async () => {
    const fetch = answer(200, [repo]);
    await expect(githubReposApi.list(signal)).resolves.toEqual([repo]);
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/api\/github-repos$/);
  });

  it('answers null when the GitHub source is off (404)', async () => {
    answer(404, { message: 'Not Found' });
    await expect(githubReposApi.list(signal)).resolves.toBeNull();
  });

  it('tells an unreachable BFF apart from other errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(githubReposApi.list(signal)).rejects.toBeInstanceOf(BffUnreachable);
    answer(500, { error: 'boom' });
    const err = await githubReposApi.list(signal).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(BffUnreachable);
  });

  it('rejects an answer that is not a list of repositories', async () => {
    answer(200, [{ ...repo, status: 'done' }]);
    await expect(githubReposApi.list(signal)).rejects.toThrow();
  });

  it('posts { repo } and reads back the repository', async () => {
    const fetch = answer(202, repo);
    await expect(githubReposApi.add('a/b', signal)).resolves.toEqual(repo);
    const [, init] = fetch.mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ repo: 'a/b' }), signal });
  });

  it('turns a refused add into a readable message', async () => {
    answer(400, { error: 'Invalid body' });
    await expect(githubReposApi.add('a/b', signal)).rejects.toThrow('The BFF could not add a/b (HTTP 400).');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(githubReposApi.add('a/b', signal)).rejects.toThrow('The BFF cannot be reached.');
  });
});
