import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useIsMobile } from './useIsMobile';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(max-width: 767px)',
    addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => listeners.delete(cb),
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => mql),
  });
  return {
    emit(next: boolean) {
      mql.matches = next;
      for (const cb of listeners) cb({ matches: next } as MediaQueryListEvent);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it('returns true below 768px', () => {
  mockMatchMedia(true);
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(true);
});

it('returns false at desktop width', () => {
  mockMatchMedia(false);
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(false);
});

it('updates when viewport crosses breakpoint', () => {
  const media = mockMatchMedia(false);
  const { result } = renderHook(() => useIsMobile());
  expect(result.current).toBe(false);
  act(() => media.emit(true));
  expect(result.current).toBe(true);
});
