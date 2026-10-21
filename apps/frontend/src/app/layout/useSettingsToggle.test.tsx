import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useSettingsToggle } from './useSettingsToggle';

function setup(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ ...useSettingsToggle(), location: useLocation() }), { wrapper });
}

describe('useSettingsToggle', () => {
  it('opens settings then returns to the previous page', () => {
    const { result } = setup('/d/characters?page=2');
    expect(result.current.open).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.location.pathname).toBe('/settings');
    expect(result.current.open).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.location.pathname).toBe('/d/characters');
    expect(result.current.location.search).toBe('?page=2');
  });

  it('falls back to the home page when settings was opened directly', () => {
    const { result } = setup('/settings');
    act(() => result.current.toggle());
    expect(result.current.location.pathname).toBe('/');
  });
});
