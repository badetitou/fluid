import { describe, expect, it } from 'vitest';
import type { GithubRepo } from '@fluid/shared';
import { bffBaseUrl, githubRepoSource, normaliseGithubRepo, repoDescription } from './model';

const repo = (extra: Partial<GithubRepo> = {}): GithubRepo => ({
  id: 'badetitou--model',
  repo: 'badetitou/Model',
  status: 'ready',
  updatedAt: '2026-11-20T10:00:00Z',
  graphqlPath: '/api/github-repos/badetitou--model/graphql',
  ...extra,
});

describe('normaliseGithubRepo', () => {
  it.each([
    ['badetitou/Model', 'badetitou/Model'],
    ['  badetitou/Model  ', 'badetitou/Model'],
    ['badetitou/Model.git', 'badetitou/Model'],
    ['https://github.com/badetitou/Model', 'badetitou/Model'],
    ['https://github.com/badetitou/Model/', 'badetitou/Model'],
    ['https://github.com/badetitou/Model.git', 'badetitou/Model'],
    ['http://www.github.com/badetitou/my.repo', 'badetitou/my.repo'],
    ['github.com/badetitou/Model', 'badetitou/Model'],
  ])('reads %s as %s', (input, expected) => {
    expect(normaliseGithubRepo(input)).toBe(expected);
  });

  it.each([
    'Model',
    'badetitou/',
    'a/b/c',
    'https://gitlab.com/badetitou/Model',
    'https://github.com/badetitou/Model/tree/main',
    'https://github.com/badetitou',
    '-bad/name',
    'owner/..',
    'owner/na me',
  ])('rejects %s with a readable message', (input) => {
    expect(() => normaliseGithubRepo(input)).toThrow('Expected owner/name or https://github.com/owner/name');
  });
});

describe('githubRepoSource', () => {
  const base = 'http://localhost:4001';

  it('makes a ready repository a pickable source on the BFF proxy', () => {
    expect(githubRepoSource(repo(), base)).toEqual({
      name: 'badetitou/Model',
      url: 'http://localhost:4001/api/github-repos/badetitou--model/graphql',
      description: 'Analysed with Model',
    });
  });

  it.each(['queued', 'downloading', 'analyzing'] as const)('marks a %s repository pending', (status) => {
    expect(githubRepoSource(repo({ status }), base).pending).toBe(true);
  });

  it('describes a failed repository with its error, not pending', () => {
    const source = githubRepoSource(repo({ status: 'failed', error: 'Repository not found on GitHub' }), base);
    expect(source.pending).toBeUndefined();
    expect(source.description).toBe('Analysis failed: Repository not found on GitHub');
  });

  it('names a ref after the repository and clips long texts to the source limits', () => {
    expect(githubRepoSource(repo({ ref: 'v1.2' }), base).name).toBe('badetitou/Model@v1.2');
    const long = githubRepoSource(repo({ repo: `o/${'n'.repeat(100)}`, status: 'failed', error: 'e'.repeat(400) }), base);
    expect(long.name).toHaveLength(80);
    expect(long.description).toHaveLength(300);
  });
});

describe('helpers', () => {
  it('describes a failed repository without an error by its status alone', () => {
    expect(repoDescription({ status: 'failed' })).toBe('Analysis failed');
  });

  it('uses the page origin when the BFF is on the same origin', () => {
    expect(bffBaseUrl('', 'https://fluid.example.org')).toBe('https://fluid.example.org');
    expect(bffBaseUrl('https://bff.example.org/', 'https://fluid.example.org')).toBe('https://bff.example.org');
  });
});
