import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const api = vi.hoisted(() => ({ discover: vi.fn() }));
vi.mock('../../bff/client', () => ({ bffClient: { sources: api } }));

import { useOAuthDiscovery } from './useOAuthDiscovery';

const found = (issuer: string | null, supportsS256 = true, server = true) => ({
  suggestion: { issuer, scopes: ['read'], resource: null },
  authorizationServer: server ? { supportsS256 } : null,
});

beforeEach(() => vi.resetAllMocks());

describe('useOAuthDiscovery', () => {
  it('asks with the source URL and the trimmed issuer, only when typed', async () => {
    api.discover.mockResolvedValue(found('https://as'));
    const { result } = renderHook(() => useOAuthDiscovery());

    let out;
    await act(async () => void (out = await result.current.discover('https://api/graphql', '  https://as  ')));
    expect(api.discover).toHaveBeenLastCalledWith({ url: 'https://api/graphql', issuer: 'https://as' });
    expect(out).toEqual(found('https://as'));
    expect(result.current.error).toBeNull();

    await act(() => result.current.discover('https://api/graphql', '   '));
    expect(api.discover).toHaveBeenLastCalledWith({ url: 'https://api/graphql' });
  });

  it('says so when the source advertises no issuer', async () => {
    api.discover.mockResolvedValue(found(null, true, false));
    const { result } = renderHook(() => useOAuthDiscovery());
    let out;
    await act(async () => void (out = await result.current.discover('https://api/graphql', '')));
    expect(out).toBeNull();
    expect(result.current.error).toMatch(/type the issuer/);
  });

  it('warns, but still answers, when the server lacks PKCE S256', async () => {
    api.discover.mockResolvedValue(found('https://as', false));
    const { result } = renderHook(() => useOAuthDiscovery());
    let out;
    await act(async () => void (out = await result.current.discover('https://api/graphql', '')));
    expect(out).not.toBeNull();
    expect(result.current.error).toMatch(/S256/);
  });

  it('reports a BFF failure', async () => {
    api.discover.mockRejectedValue(new Error('BFF GET → 502'));
    const { result } = renderHook(() => useOAuthDiscovery());
    await act(() => result.current.discover('https://api/graphql', ''));
    expect(result.current.error).toContain('502');
    expect(result.current.busy).toBe(false);
  });
});
