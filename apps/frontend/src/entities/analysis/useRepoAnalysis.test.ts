import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConnection } from '../../store';
import type { EngineBuilder } from './engine';
import type { downloadSources } from './download';
import { engineFor } from './engineRegistry';
import { useRepoAnalysis } from './useRepoAnalysis';

// The hook restarts when its inputs change identity, so every input here is a stable value.
const files = [{ path: 'a.ts', data: new Uint8Array([1]) }];
const download = (result: Promise<typeof files>): typeof downloadSources => () => result;
const unused: EngineBuilder = () => Promise.reject(new Error('unused'));

describe('useRepoAnalysis', () => {
  it('downloads, builds, registers the engine and connects', async () => {
    const built = { execute: vi.fn(), dispose: vi.fn() };
    const build: EngineBuilder = () => Promise.resolve(built);
    const target = { repo: 'a/b' };
    const get = download(Promise.resolve(files));
    const { result } = renderHook(() => useRepoAnalysis(target, build, get));
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(useConnection.getState().graphqlUrl).toBe('model-wasm://a/b');
    expect(engineFor('model-wasm://a/b')).toBe(built);
  });

  it('fails readably when nothing is analysable', async () => {
    const target = { repo: 'c/d' };
    const get = download(Promise.resolve([]));
    const { result } = renderHook(() => useRepoAnalysis(target, unused, get));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current).toMatchObject({ error: expect.stringContaining('No Java') });
  });

  it('reports a download error', async () => {
    const target = { repo: 'e/f' };
    const get = download(Promise.reject(new Error('Repository not found')));
    const { result } = renderHook(() => useRepoAnalysis(target, unused, get));
    await waitFor(() => expect(result.current).toEqual({ phase: 'failed', error: 'Repository not found' }));
  });
});
