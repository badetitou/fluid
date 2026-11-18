import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const signIn = vi.hoisted(() => ({ start: vi.fn(), onSignedIn: undefined as undefined | ((id: string) => void) }));
vi.mock('./useOAuthSignIn', () => ({
  useOAuthSignIn: (_id: string | undefined, onSignedIn: (id: string) => void) => {
    signIn.onSignedIn = onSignedIn;
    return { status: 'idle', start: signIn.start };
  },
}));

import { useConnection } from '../../store';
import { useAuthRequired } from './authRequired';
import { useSavedSources } from './store';
import { useReconnect } from './useReconnect';

const URL_ = 'https://api.example.com/graphql';

beforeEach(() => {
  vi.resetAllMocks();
  useAuthRequired.setState({ required: {}, failing: {}, epoch: {} });
  useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'a' }] });
  useConnection.setState({ graphqlUrl: URL_ });
});

describe('useReconnect', () => {
  it('has nothing to ask while the source is fine', () => {
    const { result } = renderHook(() => useReconnect());
    expect(result.current.required).toBeNull();
  });

  it('asks for the missing scope on insufficient_scope only', () => {
    useAuthRequired.getState().report('a', { reason: 'insufficient_scope', scope: 'write' }, 'q');
    const { result } = renderHook(() => useReconnect());
    act(() => result.current.reconnect());
    expect(signIn.start).toHaveBeenLastCalledWith('write');

    act(() => useAuthRequired.getState().report('a', { reason: 'expired' }, 'q'));
    act(() => result.current.reconnect());
    expect(signIn.start).toHaveBeenLastCalledWith(undefined);
  });

  it('clears the prompt and restarts the queries when the sign-in succeeded', () => {
    useAuthRequired.getState().report('a', { reason: 'expired' }, 'q');
    const { result } = renderHook(() => useReconnect());
    expect(result.current.required).toEqual({ reason: 'expired' });

    act(() => signIn.onSignedIn?.('a'));

    expect(result.current.required).toBeNull();
    expect(useAuthRequired.getState().epoch).toEqual({ a: 1 });
  });
});
