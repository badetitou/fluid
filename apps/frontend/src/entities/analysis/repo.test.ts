import { describe, expect, it } from 'vitest';
import { analysisPath, analysisUrl, parseAnalysisRepo, parseAnalysisUrl, treeUrl, rawUrl } from './repo';

describe('analysis repo', () => {
  it('parses owner/name and an optional ref', () => {
    expect(parseAnalysisRepo('badetitou', 'fluid.git')).toEqual({ repo: 'badetitou/fluid' });
    expect(parseAnalysisRepo('a', 'b', 'feat/x')).toEqual({ repo: 'a/b', ref: 'feat/x' });
  });
  it('rejects bad names and refs', () => {
    expect(() => parseAnalysisRepo('a', undefined)).toThrow();
    expect(() => parseAnalysisRepo('a b', 'c')).toThrow();
    expect(() => parseAnalysisRepo('a', 'b', '../x')).toThrow('Invalid ref');
  });
  it('round-trips the virtual URL', () => {
    const target = { repo: 'a/b', ref: 'v1' };
    expect(analysisUrl(target)).toBe('model-wasm://a/b@v1');
    expect(parseAnalysisUrl(analysisUrl(target))).toEqual(target);
    expect(parseAnalysisUrl('https://x/graphql')).toBeNull();
    expect(analysisPath(target)).toBe('/analyse/a/b?ref=v1');
  });
  it('points at the tree API and the raw host', () => {
    expect(treeUrl({ repo: 'a/b' })).toBe('https://api.github.com/repos/a/b/git/trees/HEAD?recursive=1');
    expect(rawUrl({ repo: 'a/b', ref: 'feat/x' }, 'src/a b.ts')).toBe(
      'https://raw.githubusercontent.com/a/b/feat/x/src/a%20b.ts',
    );
  });
});
