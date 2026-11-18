import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BffSourceConfig } from './api';

const api = vi.hoisted(() => ({ ping: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('./api', () => ({ bffSourcesApi: api }));

import { useSavedSources } from './store';
import { useBffSourceConfig } from './useBffSourceConfig';

const URL_ = 'https://api.example.com/graphql';
const config = (over: Partial<BffSourceConfig> = {}): BffSourceConfig => ({
  id: 'src1',
  name: 'api.example.com',
  url: URL_,
  authKind: 'none',
  headerName: null,
  hasSecret: false,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useSavedSources.setState({ saved: [{ url: URL_ }] });
  api.ping.mockResolvedValue(undefined);
  api.get.mockResolvedValue(config());
});

describe('useBffSourceConfig', () => {
  it('is unavailable when the BFF does not answer', async () => {
    api.ping.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.available).toBe(false));
    expect(result.current.routed).toBe(false);
  });

  it('turns on: creates the config and keeps only its id', async () => {
    api.create.mockResolvedValue(config());
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(() => result.current.enable());

    expect(api.create).toHaveBeenCalledWith({ name: 'api.example.com', url: URL_, authKind: 'none' });
    expect(useSavedSources.getState().saved).toEqual([{ url: URL_, bffSourceId: 'src1' }]);
    expect(result.current.routed).toBe(true);
  });

  it('sends the secret to the BFF and keeps it in no storage', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    api.get.mockResolvedValue(config());
    api.update.mockResolvedValue(config({ authKind: 'header', headerName: 'Authorization', hasSecret: true }));
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.config).not.toBeNull());

    await act(() => result.current.save({ authKind: 'header', headerName: 'Authorization', secret: 'tok-123' }));

    expect(api.update).toHaveBeenCalledWith('src1', {
      authKind: 'header',
      headerName: 'Authorization',
      secret: 'tok-123',
    });
    expect(result.current.config?.hasSecret).toBe(true);
    expect(JSON.stringify(result.current)).not.toContain('tok-123');
    expect(JSON.stringify(localStorage)).not.toContain('tok-123');
  });

  it('turns off: deletes the config and clears the id', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    api.get.mockResolvedValue(config());
    api.remove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.config).not.toBeNull());

    await act(() => result.current.disable());

    expect(api.remove).toHaveBeenCalledWith('src1');
    expect(useSavedSources.getState().saved[0].bffSourceId).toBeUndefined();
    expect(result.current.routed).toBe(false);
  });

  it('reports a failure and stays direct', async () => {
    api.create.mockRejectedValue(new Error('BFF POST /api/sources → 500'));
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(() => result.current.enable());

    expect(result.current.error).toContain('500');
    expect(result.current.routed).toBe(false);
  });
});
