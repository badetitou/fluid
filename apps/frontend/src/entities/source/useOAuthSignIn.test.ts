import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../runtime-config', () => ({ BFF_URL: 'http://localhost:4001' }));

import { useOAuthSignIn } from './useOAuthSignIn';

const BFF = 'http://localhost:4001';
type Popup = { closed: boolean; close: ReturnType<typeof vi.fn> };
const popupOf = (): Popup => ({ closed: false, close: vi.fn() });

/** A `message` event as the browser would deliver it: `source` is read-only, so it is defined on the instance. */
const post = (data: unknown, { origin = BFF, source }: { origin?: string; source: unknown }) =>
  act(() => {
    const event = new MessageEvent('message', { data, origin });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
  });
const message = (sourceId: string, ok = true) => ({ type: 'fluid-oauth', sourceId, ok });

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

  it('signs in on the message of its popup from the BFF, for this source, and says which source', () => {
    const popup = popupOf();
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const onSignedIn = vi.fn();
    const { result } = renderHook(() => useOAuthSignIn('s1', onSignedIn));
    act(() => result.current.start());
    expect(result.current.status).toBe('waiting');

    post(message('s1'), { origin: 'https://evil.example', source: popup });
    post(message('s2'), { source: popup });
    post(message('s1'), { source: window }); // another window, even with the right origin and shape
    post(message('s1'), { source: null });
    expect(onSignedIn).not.toHaveBeenCalled();

    post(message('s1'), { source: popup });
    expect(onSignedIn).toHaveBeenCalledExactlyOnceWith('s1');
    expect(result.current.status).toBe('idle');
  });

  it('reports a failed sign-in', () => {
    const popup = popupOf();
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const onSignedIn = vi.fn();
    const { result } = renderHook(() => useOAuthSignIn('s1', onSignedIn));
    act(() => result.current.start());
    post(message('s1', false), { source: popup });
    expect(result.current.status).toBe('failed');
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('gives a closed popup a few seconds for its message, then calls onClosed', () => {
    const popup = popupOf();
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const onSignedIn = vi.fn();
    const onClosed = vi.fn();
    const { result } = renderHook(() => useOAuthSignIn('s1', onSignedIn, onClosed));

    act(() => result.current.start());
    popup.closed = true;
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe('waiting');
    post(message('s1'), { source: popup });
    act(() => void vi.advanceTimersByTime(10_000));
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(onClosed).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');

    act(() => result.current.start());
    act(() => void vi.advanceTimersByTime(10_000));
    expect(result.current.status).toBe('closed');
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('s1');
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('drops a sign-in in progress when the source changes: popup closed, status idle, late success ignored', () => {
    const popup = popupOf();
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const onSignedIn = vi.fn();
    const { result, rerender } = renderHook(({ id }) => useOAuthSignIn(id, onSignedIn), { initialProps: { id: 'A' } });
    act(() => result.current.start());
    expect(result.current.status).toBe('waiting');

    rerender({ id: 'B' });

    expect(result.current.status).toBe('idle');
    expect(popup.close).toHaveBeenCalled();
    post(message('A'), { source: popup });
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
