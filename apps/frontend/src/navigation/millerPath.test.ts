import { describe, expect, it } from 'vitest';
import {
  appendColumn,
  columnSegment,
  HOME_PATH,
  parseColumnSegment,
  parseDashboardSplat,
  rootOfPathname,
  rootPath,
  rootSegment,
  splatFromPathname,
} from './millerPath';

/** A SCIP key: `/` must not become a column separator. */
const scipKey = 'model java . . java/lang/String#`<init>`().';
const encodedScipKey = 'model%20java%20.%20.%20java%2Flang%2FString%23%60%3Cinit%3E%60().';

describe('column segments', () => {
  it('writes a work list as the concept and an item after an @', () => {
    expect(columnSegment({ concept: 'Country' })).toBe('Country');
    expect(columnSegment({ concept: 'Country', itemId: 'A/B@1' })).toBe('Country@A%2FB%401');
    expect(columnSegment({ concept: 'Constructor', itemId: scipKey })).toBe(`Constructor@${encodedScipKey}`);
  });

  it('reads the id after the first @, keeping a leading @ in the name', () => {
    expect(parseColumnSegment('Country@AD')).toEqual({ concept: 'Country', itemId: 'AD' });
    expect(parseColumnSegment('User@a@b.c')).toEqual({ concept: 'User', itemId: 'a@b.c' });
    expect(parseColumnSegment('@graph')).toEqual({ concept: '@graph' });
  });

  it('round-trips ids with separators and reserved characters', () => {
    const ids = [
      scipKey,
      '100% sure @home',
      'a#b?c&d=e',
      'spaces   and/back\\slash',
      '@leading',
      'a+b=c',
    ];
    for (const itemId of ids) {
      expect(parseColumnSegment(columnSegment({ concept: 'Constructor', itemId }))).toEqual({
        concept: 'Constructor',
        itemId,
      });
    }
  });

  it('keeps a malformed percent escape as is', () => {
    expect(parseColumnSegment('Country@100%zz')).toEqual({ concept: 'Country', itemId: '100%zz' });
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

  it('keeps a key containing "/" in a single column', () => {
    const href = appendColumn('/d/Constructor', { concept: 'Constructor', itemId: scipKey });
    expect(href).toBe(`/d/Constructor/Constructor@${encodedScipKey}`);
    expect(parseDashboardSplat(splatFromPathname(href)).stack).toEqual([{ concept: 'Constructor', itemId: scipKey }]);
  });

  it('canonicalizes an encoded root segment for the columns appended to it', () => {
    const root = { kind: 'column' as const, concept: 'Constructor', itemId: scipKey };
    const parsed = parseDashboardSplat(splatFromPathname(rootPath(root)));
    expect(parsed.root).toEqual(root);
    expect(parsed.rootSegment).toBe(rootSegment(root));
  });
});

describe('paths', () => {
  it('opens roots as pages and appends columns', () => {
    expect(rootPath({ kind: 'home' })).toBe('/');
    expect(rootPath({ kind: 'dashboard', id: 'x' })).toBe('/d/~x');
    expect(rootPath({ kind: 'column', concept: 'Country' })).toBe('/d/Country');
    expect(appendColumn(`${HOME_PATH}/`, { concept: 'Country' })).toBe('/d/@home/Country');
  });

  it('extracts the still-encoded splat from a pathname', () => {
    expect(splatFromPathname(`/d/Constructor/Constructor@${encodedScipKey}`)).toBe(`Constructor/Constructor@${encodedScipKey}`);
    expect(splatFromPathname('/d/')).toBe('');
    expect(splatFromPathname('/')).toBe('');
    expect(splatFromPathname('/settings')).toBe('');
  });

  it('finds the root of a pathname', () => {
    expect(rootOfPathname('/')).toEqual({ kind: 'home' });
    expect(rootOfPathname('/d/%40home/Country')).toEqual({ kind: 'home' });
    expect(rootOfPathname('/d/~x/Country@AD')).toEqual({ kind: 'dashboard', id: 'x' });
    expect(rootOfPathname(`/d/Constructor@${encodedScipKey}/Next`)).toEqual({
      kind: 'column',
      concept: 'Constructor',
      itemId: scipKey,
    });
    expect(rootOfPathname('/settings')).toBeNull();
  });
});
