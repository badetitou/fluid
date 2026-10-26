import { describe, expect, it } from 'vitest';
import { hiddenViewsScope, splitHidden, withHidden } from './viewVisibility';

describe('withHidden', () => {
  it('hides a key once and shows it again', () => {
    const hidden = withHidden({}, 's', 'a', true);
    expect(hidden).toEqual({ s: ['a'] });
    expect(withHidden(hidden, 's', 'a', true)).toBe(hidden);
    expect(withHidden(hidden, 's', 'a', false)).toEqual({});
  });

  it('leaves other scopes alone', () => {
    expect(withHidden({ t: ['x'] }, 's', 'a', true)).toEqual({ t: ['x'], s: ['a'] });
  });
});

describe('splitHidden', () => {
  it('keeps the pill order on both sides', () => {
    const entries = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    expect(splitHidden(entries, ['c', 'a'])).toEqual({ visible: [{ key: 'b' }], hidden: [{ key: 'a' }, { key: 'c' }] });
  });
});

describe('hiddenViewsScope', () => {
  it('separates sources, concepts and column kinds', () => {
    expect(hiddenViewsScope('u', 'Account', 'list')).not.toBe(hiddenViewsScope('u', 'Account', 'detail'));
    expect(hiddenViewsScope(null, 'Account', 'list')).toBe('|Account|list');
  });
});
