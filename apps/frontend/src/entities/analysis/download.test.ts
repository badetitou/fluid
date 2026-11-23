import { describe, expect, it, vi } from 'vitest';
import { downloadSources } from './download';
import { isModelSource } from './sourceFilter';

const signal = new AbortController().signal;
const tree = (entries: object[], truncated = false) => Response.json({ truncated, tree: entries });

/** A fetch answering the tree API and the raw host from a path → content map. */
const fakeFetch = (entries: object[], files: Record<string, string>, truncated = false): typeof fetch =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/git/trees/')) return tree(entries, truncated);
    const path = decodeURIComponent(url.split('/HEAD/')[1]);
    return path in files ? new Response(files[path]) : new Response('', { status: 404 });
  });

describe('downloadSources', () => {
  it('reads only the files Model can use, sorted', async () => {
    const get = fakeFetch(
      [
        { path: 'src/b.ts', type: 'blob', size: 5 },
        { path: 'src/a.java', type: 'blob', size: 5 },
        { path: 'README.md', type: 'blob', size: 5 },
        { path: 'src', type: 'tree' },
      ],
      { 'src/b.ts': 'let b', 'src/a.java': 'class A' },
    );
    const progress = vi.fn();
    const files = await downloadSources({ repo: 'a/b' }, signal, progress, get);
    expect(files.map((f) => f.path)).toEqual(['src/a.java', 'src/b.ts']);
    expect(new TextDecoder().decode(files[1].data)).toBe('let b');
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });
  it('explains a missing repository and a truncated listing', async () => {
    const missing = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(downloadSources({ repo: 'a/b' }, signal, undefined, missing)).rejects.toThrow('not found');
    await expect(downloadSources({ repo: 'a/b' }, signal, undefined, fakeFetch([], {}, true))).rejects.toThrow('too large');
  });
});

describe('isModelSource', () => {
  it('keeps supported languages and manifests', () => {
    expect(isModelSource('src/A.java', 10)).toBe(true);
    expect(isModelSource('package.json', 10)).toBe(true);
    expect(isModelSource('src/A.st', 10)).toBe(true);
  });
  it('drops the rest', () => {
    expect(isModelSource('node_modules/x/a.ts', 10)).toBe(false);
    expect(isModelSource('types/a.d.ts', 10)).toBe(false);
    expect(isModelSource('a.ts', 2 * 1024 * 1024)).toBe(false);
    expect(isModelSource('README.md', 10)).toBe(false);
  });
});
