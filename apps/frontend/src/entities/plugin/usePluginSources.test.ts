import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ActiveSourceProvider } from './model';
import type { SourceEntry } from './manifest';
import { SourceProviderUnavailable } from './sourceProvider';
import { usePluginSources } from './usePluginSources';

let active: ActiveSourceProvider[] = [];
vi.mock('./usePlugins', () => ({ useActiveSourceProviders: () => active }));

const repo = (pending: boolean): SourceEntry => ({ name: 'a/b', url: 'http://bff/a--b/graphql', pending });

afterEach(() => vi.useRealTimers());

describe('usePluginSources', () => {
  it('binds the settings to the add form and lists again once a source is added', async () => {
    let listed: SourceEntry[] = [];
    const listSources = vi.fn(async () => listed);
    const submit = vi.fn(async () => {
      listed = [repo(false)];
    });
    active = [
      { provider: { id: 'gh', label: 'GitHub', listSources, addSource: { label: 'Add', submit } }, settings: { k: 'v' } },
    ];
    const { result } = renderHook(() => usePluginSources());
    await waitFor(() => expect(result.current[0]?.addSource?.label).toBe('Add'));
    expect(result.current[0].sources).toEqual([]);

    const signal = new AbortController().signal;
    await act(() => result.current[0].addSource!.submit('a/b', signal));
    expect(submit).toHaveBeenCalledWith('a/b', { k: 'v' }, signal);
    await waitFor(() => expect(result.current[0].sources).toEqual([repo(false)]));
  });

  it('lists again every pollMs while a source is pending, and stops once none is', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const answers = [[repo(true)], [repo(true)], [repo(false)]];
    const listSources = vi.fn(async () => answers[Math.min(listSources.mock.calls.length - 1, 2)]);
    active = [{ provider: { id: 'gh', label: 'GitHub', listSources, pollMs: 1000 }, settings: {} }];
    const { result } = renderHook(() => usePluginSources());
    await waitFor(() => expect(result.current[0]?.sources[0].pending).toBe(true));
    expect(listSources).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(listSources).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(result.current[0].sources[0].pending).toBe(false));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(listSources).toHaveBeenCalledTimes(3);
  });

  it('leaves out a provider that is unavailable, but shows the error of one that failed', async () => {
    const add = { label: 'Add', submit: async () => {} };
    active = [
      {
        provider: { id: 'gh', label: 'GitHub', listSources: () => Promise.reject(new SourceProviderUnavailable('off')), addSource: add },
        settings: {},
      },
      { provider: { id: 'x', label: 'X', listSources: () => Promise.reject(new Error('boom')) }, settings: {} },
    ];
    const { result } = renderHook(() => usePluginSources());
    await waitFor(() => expect(result.current.map((g) => [g.providerId, g.error])).toEqual([['x', 'boom']]));
  });

  it('keeps polling a pending source through a failed listing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let call = 0;
    const listSources = vi.fn(async () => {
      call += 1;
      if (call === 2) throw new Error('network down');
      return [repo(call < 3)];
    });
    active = [{ provider: { id: 'gh', label: 'GitHub', listSources, pollMs: 1000 }, settings: {} }];
    const { result } = renderHook(() => usePluginSources());
    await waitFor(() => expect(result.current[0]?.sources[0].pending).toBe(true));

    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(result.current[0].error).toBe('network down'));
    expect(result.current[0].sources).toEqual([repo(true)]);

    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(result.current[0].sources).toEqual([repo(false)]));
    expect(result.current[0].error).toBeUndefined();
  });

  it('does not list again when a submit is refused', async () => {
    const listSources = vi.fn(async () => []);
    const submit = vi.fn(async () => {
      throw new Error('Expected owner/name');
    });
    active = [{ provider: { id: 'gh', label: 'GitHub', listSources, addSource: { label: 'Add', submit } }, settings: {} }];
    const { result } = renderHook(() => usePluginSources());
    await waitFor(() => expect(result.current[0]?.addSource).toBeDefined());
    await expect(result.current[0].addSource!.submit('x', new AbortController().signal)).rejects.toThrow('Expected');
    await new Promise((r) => setTimeout(r, 20));
    expect(listSources).toHaveBeenCalledTimes(1);
  });
});
