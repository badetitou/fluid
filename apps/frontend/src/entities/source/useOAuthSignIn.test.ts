import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../runtime-config', () => ({ BFF_URL: 'http://localhost:4001' }));

import { useOAuthSignIn } from './useOAuthSignIn';

const BFF = 'http://localhost:4001';
const post = (data: unknown, origin = BFF) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useOAuthSignIn', () => {
  it('opens the BFF start URL and reports a blocked popup', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { result } = renderHook(() => useOAuthSignIn('s1', vi.fn()));
    act(() => result.current.start('write'));
    expect(String(open.mock.calls[0][0])).toBe(
      `${BFF}/api/sources/s1/oauth/start?origin=${encodeURIComponent(window.location.origin)}&scope=write`,
    );
    expect(result.current.status).toBe('blocked');
  });

  it('signs in on the BFF message of this source, ignoring other origins and sources', () => {
    vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
    const onSignedIn = vi.fn();
    const { result } = renderHook(() => useOAuthSignIn('s1', onSignedIn));
    act(() => result.current.start());
    expect(result.current.status).toBe('waiting');

    post({ type: 'fluid-oauth', sourceId: 's1', ok: true }, 'https://evil.example');
    post({ type: 'fluid-oauth', sourceId: 's2', ok: true });
    expect(onSignedIn).not.toHaveBeenCalled();

    post({ type: 'fluid-oauth', sourceId: 's1', ok: true });
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('reports a failed sign-in', () => {
    vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
    const onSignedIn = vi.fn();
    const { result } = renderHook(() => useOAuthSignIn('s1', onSignedIn));
    act(() => result.current.start());
    post({ type: 'fluid-oauth', sourceId: 's1', ok: false });
    expect(result.current.status).toBe('failed');
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('notices a popup closed without a message, but lets a late message win', () => {
    const popup = { closed: false } as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const onSignedIn = vi.fn();
    const { result } = renderHook(() => useOAuthSignIn('s1', onSignedIn));

    act(() => result.current.start());
    Object.assign(popup, { closed: true });
    act(() => void vi.advanceTimersByTime(500));
    post({ type: 'fluid-oauth', sourceId: 's1', ok: true });
    act(() => void vi.advanceTimersByTime(2000));
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');

    act(() => result.current.start());
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe('closed');
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });
});
