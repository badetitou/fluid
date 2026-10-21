/**
 * Tests for the Miller navigation hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useMillerNavigation } from './useMillerNavigation';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: '/d/Account/Account@ACC-001',
    }),
  };
});

describe('useMillerNavigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should navigate to entity in Miller view', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>{children}</BrowserRouter>
    );

    const { result } = renderHook(() => useMillerNavigation({ isMillerView: true }), { wrapper });

    act(() => {
      result.current.navigateToEntity('Customer', 'CUST-001');
    });

    // Should be called with the constructed URL
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should navigate to entity in concept view', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>{children}</BrowserRouter>
    );

    const { result } = renderHook(() => useMillerNavigation({ isMillerView: false }), { wrapper });

    act(() => {
      result.current.navigateToEntity('Customer', 'CUST-001');
    });

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should handle navigate back in Miller view', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>{children}</BrowserRouter>
    );

    const { result } = renderHook(() => useMillerNavigation({ isMillerView: true }), { wrapper });

    act(() => {
      result.current.navigateBack();
    });

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should warn when no itemId provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>{children}</BrowserRouter>
    );

    const { result } = renderHook(() => useMillerNavigation({ isMillerView: true }), { wrapper });

    act(() => {
      result.current.navigateToEntity('Customer', '');
    });

    expect(warnSpy).toHaveBeenCalledWith('Cannot navigate to entity: no itemId provided');
    warnSpy.mockRestore();
  });
});
