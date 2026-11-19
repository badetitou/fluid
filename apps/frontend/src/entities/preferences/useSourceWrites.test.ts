import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../../bff/client', () => ({ bffClient: { sources: api } }));

import { useConnection, useWritableSources } from '../../store';
import { useSavedSources } from '../source/store';
import { useSourceWrites } from './useSourceWrites';

const URL_ = 'https://api.example.com/graphql';

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useConnection.setState({ graphqlUrl: URL_ });
  useWritableSources.setState({ byUrl: {} });
  useSavedSources.setState({ saved: [{ url: URL_ }] });
});

describe('useSourceWrites', () => {
  it('keeps the setting here for a direct source', () => {
    const { result } = renderHook(() => useSourceWrites());
    act(() => result.current.setWritable(true));
    expect(result.current.writable).toBe(true);
    expect(api.update).not.toHaveBeenCalled();
  });

  it('also sends it to the BFF for a routed source, and says when the BFF refused', async () => {
    useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'src1' }] });
    api.update.mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => useSourceWrites());
    act(() => result.current.setWritable(true));
    expect(api.update).toHaveBeenCalledWith('src1', { allowWrites: true });
    await waitFor(() => expect(result.current.syncError).toContain('down'));
    expect(result.current.writable).toBe(true);
  });
});
