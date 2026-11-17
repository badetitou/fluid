import { describe, expect, it } from 'vitest';
import type { InsightAnalysis } from '@fluid/shared';
import { cacheKey, createInsightCache } from './insightCache';

const analysis = (headline: string): InsightAnalysis => ({ verdict: 'nothing', headline, findings: [] });

describe('createInsightCache', () => {
  it('drops the least recently used entry beyond its size', () => {
    const cache = createInsightCache(2);
    cache.set('a', analysis('a'));
    cache.set('b', analysis('b'));
    expect(cache.get('a')?.headline).toBe('a');
    cache.set('c', analysis('c'));
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')?.headline).toBe('a');
    expect(cache.get('c')?.headline).toBe('c');
  });

  it('forgets an entry, or everything', () => {
    const cache = createInsightCache();
    cache.set('a', analysis('a'));
    cache.set('b', analysis('b'));
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    cache.clear();
    expect(cache.get('b')).toBeUndefined();
  });
});

describe('cacheKey', () => {
  it('is the same for one analyser, different for another (new LLM settings)', () => {
    const first = () => undefined;
    const second = () => undefined;
    expect(cacheKey(first, 'r')).toBe(cacheKey(first, 'r'));
    expect(cacheKey(first, 'r')).not.toBe(cacheKey(second, 'r'));
    expect(cacheKey(first, 'r')).not.toBe(cacheKey(first, 's'));
  });
});
