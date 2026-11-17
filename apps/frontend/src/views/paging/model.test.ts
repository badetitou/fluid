import { describe, expect, it } from 'vitest';
import { countRows, isPaged, mayBeTruncated, mergePages, pagedPaths, withOffset } from './model';

const LIST = 'query L($take: Int) { methods(take: $take) { name } models { name } }';
const WRAPPED = 'query W($take: Int) { characters(first: $take) { info { count } results { name } } }';

describe('paged queries', () => {
  it('pages only queries declaring $take', () => {
    expect(isPaged(LIST)).toBe(true);
    expect(isPaged('{ methods(take: 10) { name } }')).toBe(false);
    expect(isPaged('not graphql')).toBe(false);
  });

  it('finds the fields limited by $take, by alias', () => {
    expect(pagedPaths(LIST)).toEqual([['methods']]);
    expect(pagedPaths('query($take: Int) { m: methods(take: $take) { name } }')).toEqual([['m']]);
    expect(pagedPaths(WRAPPED)).toEqual([['characters']]);
  });

  it('adds the offset argument next to $take', () => {
    const q = withOffset(LIST, 'skip')!;
    expect(q).toContain('$fluidSkip: Int');
    expect(q).toContain('methods(take: $take, skip: $fluidSkip)');
    expect(q).toContain('models {');
    expect(withOffset('{', 'skip')).toBeNull();
  });
});

describe('rows', () => {
  it('counts the rows of a list or of a pagination wrapper', () => {
    expect(countRows({ methods: [1, 2, 3], models: [1] }, [['methods']])).toBe(3);
    expect(countRows({ characters: { info: { count: 9 }, results: [1, 2] } }, [['characters']])).toBe(2);
    expect(countRows(undefined, [['methods']])).toBe(0);
  });

  it('may be truncated when as many rows as asked, or as the source answers at most', () => {
    expect(mayBeTruncated(100, 100)).toBe(true);
    expect(mayBeTruncated(42, 100)).toBe(false);
    expect(mayBeTruncated(1000, 5000, 1000)).toBe(true);
    expect(mayBeTruncated(0, 0)).toBe(false);
  });

  it('merges pages on the paged lists only', () => {
    const paths = [['methods']];
    const merged = mergePages({ methods: [1, 2], models: ['a'] }, { methods: [3], models: ['a'] }, paths);
    expect(merged).toEqual({ methods: [1, 2, 3], models: ['a'] });
    const wrapped = mergePages(
      { characters: { info: { count: 9 }, results: [1] } },
      { characters: { info: { count: 9 }, results: [2] } },
      [['characters']],
    );
    expect(wrapped).toEqual({ characters: { info: { count: 9 }, results: [1, 2] } });
  });
});
