import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GraphSessionProvider, useGraphSessionStore } from './GraphSessionProvider';
import { emptyGraphSessionState, type GraphSessionState } from './model';
import { useGraphSessionState } from './useGraphSessionState';

const wrapper = ({ children }: { children: ReactNode }) => <GraphSessionProvider>{children}</GraphSessionProvider>;
const seeded = (key: string): GraphSessionState => ({ ...emptyGraphSessionState, expanded: [key] });

describe('useGraphSessionState', () => {
  it('seeds the store with the initial state', () => {
    const { result } = renderHook(() => useGraphSessionState('seed', seeded('a')), { wrapper });
    expect(result.current[0]).toEqual(seeded('a'));
  });

  it('lets the store win over a later initial value', () => {
    const { result, rerender } = renderHook(({ initial }) => useGraphSessionState('defaults', initial), {
      wrapper,
      initialProps: { initial: seeded('a') },
    });
    rerender({ initial: seeded('b') });
    expect(result.current[0].expanded).toEqual(['a']);
    act(() => result.current[1]({ focus: 'n1' }));
    expect(result.current[0]).toMatchObject({ expanded: ['a'], focus: 'n1' });
  });

  it('merges patches and gives updaters the previous state', () => {
    const { result } = renderHook(() => useGraphSessionState('patch'), { wrapper });
    act(() => {
      result.current[1]({ groupBy: 'kind' });
      result.current[1]((prev) => ({ ...prev, expanded: [...prev.expanded, 'x'] }));
      result.current[1]((prev) => ({ ...prev, expanded: [...prev.expanded, 'y'] }));
    });
    expect(result.current[0]).toMatchObject({ expanded: ['x', 'y'], groupBy: 'kind' });
  });

  it('notifies every hook using the same key, and only that key', () => {
    const { result } = renderHook(
      () => ({
        first: useGraphSessionState('shared'),
        second: useGraphSessionState('shared'),
        other: useGraphSessionState('other'),
      }),
      { wrapper },
    );
    act(() => result.current.first[1]({ focus: 'n2' }));
    expect(result.current.second[0].focus).toBe('n2');
    expect(result.current.other[0].focus).toBeUndefined();
  });

  it('notifies direct store subscribers and unsubscribes cleanly', () => {
    const storeHook = renderHook(() => useGraphSessionStore(), { wrapper });
    const stateHook = renderHook(() => useGraphSessionState('subscribed'), { wrapper });
    // A store from a different provider instance: subscribe/set on that same store.
    const store = storeHook.result.current;
    const listener = vi.fn();
    const unsubscribe = store.subscribe('subscribed', listener);
    act(() => store.set('subscribed', seeded('z')));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    act(() => store.set('subscribed', seeded('w')));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(stateHook.result.current[0].expanded).toEqual([]);
  });

  it('never writes to browser storage and loses state with a new provider', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const first = renderHook(() => useGraphSessionState('volatile'), { wrapper });
    act(() => first.result.current[1]({ focus: 'gone' }));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();

    const second = renderHook(() => useGraphSessionState('volatile'), { wrapper });
    expect(second.result.current[0]).toEqual(emptyGraphSessionState);
  });
});
