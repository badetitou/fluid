import { describe, expect, it, vi } from 'vitest';
import type { GithubRepo } from '@fluid/shared';
import { SourceProviderUnavailable } from '../../sourceProvider';
import type { GithubReposApi } from './githubReposApi';
import { GITHUB_POLL_MS, githubSourceProvider } from './provider';

const signal = new AbortController().signal;
const repo = (status: GithubRepo['status']): GithubRepo => ({
  id: 'a--b',
  repo: 'a/b',
  status,
  updatedAt: '2026-11-20T10:00:00Z',
  graphqlPath: '/api/github-repos/a--b/graphql',
});

const api = (list: GithubRepo[] | null): GithubReposApi => ({
  list: vi.fn(async () => list),
  add: vi.fn(async (name: string) => ({ ...repo('queued'), repo: name })),
});

describe('github source provider', () => {
  it('lists the BFF repositories as sources on the BFF proxy, pending until analysed', async () => {
    const ready = { ...repo('ready'), id: 'c--d', repo: 'c/d', graphqlPath: '/api/github-repos/c--d/graphql' };
    const provider = githubSourceProvider(api([repo('analyzing'), ready]), 'http://bff');
    const sources = await provider.listSources({}, signal);
    expect(sources).toEqual([
      { name: 'a/b', url: 'http://bff/api/github-repos/a--b/graphql', description: 'Analysing with Model…', pending: true },
      { name: 'c/d', url: 'http://bff/api/github-repos/c--d/graphql', description: 'Analysed with Model' },
    ]);
    expect(provider.pollMs).toBe(GITHUB_POLL_MS);
  });

  it('is unavailable when the BFF does not serve GitHub repositories', async () => {
    const provider = githubSourceProvider(api(null), 'http://bff');
    await expect(provider.listSources({}, signal)).rejects.toBeInstanceOf(SourceProviderUnavailable);
  });

  it('posts the normalised owner/name of what the user typed', async () => {
    const backend = api([]);
    const provider = githubSourceProvider(backend, 'http://bff');
    await provider.addSource!.submit('https://github.com/badetitou/Model.git', {}, signal);
    expect(backend.add).toHaveBeenCalledWith('badetitou/Model', signal);
  });

  it('refuses what is not a repository before asking the BFF', async () => {
    const backend = api([]);
    const provider = githubSourceProvider(backend, 'http://bff');
    await expect(provider.addSource!.submit('not a repo', {}, signal)).rejects.toThrow('Expected owner/name');
    expect(backend.add).not.toHaveBeenCalled();
  });
});
