import { describe, expect, it } from 'vitest';
import {
  appendColumn,
  columnSegment,
  HOME_PATH,
  parseColumnSegment,
  parseDashboardSplat,
  rootOfPathname,
  rootPath,
} from './millerPath';

describe('column segments', () => {
  it('writes a work list as the concept and an item after an @', () => {
    expect(columnSegment({ concept: 'Country' })).toBe('Country');
    expect(columnSegment({ concept: 'Country', itemId: 'A/B@1' })).toBe('Country@A%2FB%401');
  });

  it('reads the id after the first @, keeping a leading @ in the name', () => {
    expect(parseColumnSegment('Country@AD')).toEqual({ concept: 'Country', itemId: 'AD' });
    expect(parseColumnSegment('User@a@b.c')).toEqual({ concept: 'User', itemId: 'a@b.c' });
    expect(parseColumnSegment('@graph')).toEqual({ concept: '@graph' });
  });
});

describe('parseDashboardSplat', () => {
  it('reads the root dashboard and the columns opened after it', () => {
    expect(parseDashboardSplat('~dash-1/Country/Country@AD')).toEqual({
      root: { kind: 'dashboard', id: 'dash-1' },
      rootSegment: '~dash-1',
      stack: [{ concept: 'Country' }, { concept: 'Country', itemId: 'AD' }],
    });
  });

  it('defaults to the Concepts page and reads concept roots', () => {
    expect(parseDashboardSplat('').root).toEqual({ kind: 'home' });
    expect(parseDashboardSplat('Country@AD/').root).toEqual({ kind: 'column', concept: 'Country', itemId: 'AD' });
  });
});

describe('paths', () => {
  it('opens roots as pages and appends columns', () => {
    expect(rootPath({ kind: 'home' })).toBe('/');
    expect(rootPath({ kind: 'dashboard', id: 'x' })).toBe('/d/~x');
    expect(rootPath({ kind: 'column', concept: 'Country' })).toBe('/d/Country');
    expect(appendColumn(`${HOME_PATH}/`, { concept: 'Country' })).toBe('/d/@home/Country');
  });

  it('finds the root of a pathname', () => {
    expect(rootOfPathname('/')).toEqual({ kind: 'home' });
    expect(rootOfPathname('/d/%40home/Country')).toEqual({ kind: 'home' });
    expect(rootOfPathname('/d/~x/Country@AD')).toEqual({ kind: 'dashboard', id: 'x' });
    expect(rootOfPathname('/settings')).toBeNull();
  });
});
