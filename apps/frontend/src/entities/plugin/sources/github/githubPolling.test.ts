import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { GithubRepo } from '@fluid/shared';
import type { ActiveSourceProvider } from '../../model';
import { usePluginSources } from '../../usePluginSources';
import { BffUnreachable, type GithubReposApi } from './githubReposApi';
import { GITHUB_POLL_MS, githubSourceProvider } from './provider';

let active: ActiveSourceProvider[] = [];
vi.mock('../../usePlugins', () => ({ useActiveSourceProviders: () => active }));

const repo = (status: GithubRepo['status']): GithubRepo => ({
  id: 'a--b',
  repo: 'a/b',
  status,
  updatedAt: '2026-11-20T10:00:00Z',
  graphqlPath: '/api/github-repos/a--b/graphql',
});

afterEach(() => vi.useRealTimers());

describe('github provider in the switcher', () => {
  it('lists again every pollMs while a repository is pending, and keeps its group through a network blip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const list = vi
      .fn<GithubReposApi['list']>()
      .mockResolvedValueOnce([repo('analyzing')])
      .mockRejectedValueOnce(new BffUnreachable())
      .mockResolvedValue([repo('ready')]);
    const provider = githubSourceProvider({ list, add: vi.fn() }, 'http://bff');
    active = [{ provider, settings: {} }];
    const { result } = renderHook(() => usePluginSources());
    await waitFor(() => expect(result.current[0]?.sources[0]?.pending).toBe(true));

    await act(() => vi.advanceTimersByTimeAsync(GITHUB_POLL_MS));
    expect(list).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current[0]?.error).toBe('The BFF cannot be reached.'));
    expect(result.current[0].addSource).toBeDefined();
  });
});
