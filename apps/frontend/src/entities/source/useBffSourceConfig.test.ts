import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BffSourceConfig } from '../../bff/sourcesApi';
import { BffHttpError } from '../../bff/http';

const api = vi.hoisted(() => ({ ping: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), signOut: vi.fn() }));
vi.mock('../../bff/client', () => ({ bffClient: { sources: api } }));

import { useAuthRequired } from './authRequired';
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

  it('still clears the local id when the BFF cannot delete the config, and warns', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    api.remove.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.config).not.toBeNull());

    await act(() => result.current.disable());

    expect(useSavedSources.getState().saved[0].bffSourceId).toBeUndefined();
    expect(result.current.error).toContain('may remain on the BFF');
  });

  it('goes back to a direct connection when the stored id is gone (404)', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'gone' }] });
    api.get.mockRejectedValue(new BffHttpError('BFF GET → 404', 404));
    renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(useSavedSources.getState().saved[0].bffSourceId).toBeUndefined());
  });

  it('drops the config and error of the previous source when the source changes', async () => {
    const OTHER = 'https://other.example.com/graphql';
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }, { url: OTHER }] });
    api.get.mockResolvedValue(config());
    const { result, rerender } = renderHook(({ url }) => useBffSourceConfig(url), { initialProps: { url: URL_ } });
    await waitFor(() => expect(result.current.config?.id).toBe('src1'));

    rerender({ url: OTHER });

    await waitFor(() => expect(result.current.config).toBeNull());
    expect(result.current.routed).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('signs out then reads the config again; refresh restarts the queries of the source', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    const signedIn = config({ authKind: 'oauth' });
    api.get.mockResolvedValue(signedIn);
    api.signOut.mockResolvedValue(undefined);
    useAuthRequired.setState({ required: { src1: { reason: 'expired' } }, failing: {}, epoch: {} });
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.config?.id).toBe('src1'));

    await act(() => result.current.signOut());
    expect(api.signOut).toHaveBeenCalledWith('src1');

    expect(useAuthRequired.getState().epoch).toEqual({ src1: 1 });

    await act(() => result.current.signedIn('src1'));
    expect(useAuthRequired.getState().required).toEqual({});
    expect(useAuthRequired.getState().epoch).toEqual({ src1: 2 });
  });

  it('restarts the queries on a sign-in even when the config cannot be read again', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.config?.id).toBe('src1'));
    api.get.mockRejectedValue(new Error('down'));
    useAuthRequired.setState({ required: { src1: { reason: 'expired' } }, failing: { src1: ['q'] }, epoch: {} });

    await act(() => result.current.signedIn('src1'));

    expect(useAuthRequired.getState().epoch).toEqual({ src1: 1 });
    expect(useAuthRequired.getState().required).toEqual({});
  });

  it('turns on with the OAuth settings of the source plugin, no secret', async () => {
    api.create.mockResolvedValue(config());
    const suggested = { kind: 'oauth' as const, issuer: 'https://as', clientId: 'fluid' };
    const { result } = renderHook(() => useBffSourceConfig(URL_, undefined, suggested));
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(() => result.current.enable());

    expect(api.create).toHaveBeenCalledWith({
      name: 'api.example.com',
      url: URL_,
      authKind: 'oauth',
      oauth: { issuer: 'https://as', clientId: 'fluid', scopes: [] },
    });
  });

  it('removes only the OAuth client secret', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    api.update.mockResolvedValue(config());
    const { result } = renderHook(() => useBffSourceConfig(URL_));
    await waitFor(() => expect(result.current.config?.id).toBe('src1'));

    await act(() => result.current.removeClientSecret());

    expect(api.update).toHaveBeenCalledWith('src1', { oauth: { clientSecret: null } });
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
