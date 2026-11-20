import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ActiveSourceProvider } from './model';
import type { SourceEntry } from './manifest';
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
});
