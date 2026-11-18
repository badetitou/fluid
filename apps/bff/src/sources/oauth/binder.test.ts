import { describe, expect, it } from 'vitest';
import { binderCookieName, binderMatches, hashBinder, newBinder, readBinder, setBinderCookie } from './binder';

describe('binder cookie', () => {
  it('matches only the binder it was derived from', () => {
    const b = newBinder();
    expect(binderMatches(hashBinder(b), b)).toBe(true);
    expect(binderMatches(hashBinder(b), newBinder())).toBe(false);
    expect(binderMatches(hashBinder(b), null)).toBe(false);
  });

  it('sets an HttpOnly, SameSite=Lax cookie on the oauth path and reads it back', () => {
    const cookie = setBinderCookie('st', 'abc', true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/oauth');
    expect(cookie).toContain('Secure');
    expect(setBinderCookie('st', 'abc', false)).not.toContain('Secure');
    const header = `a=1; ${setBinderCookie('st', 'abc', false).split(';')[0]}; ${setBinderCookie('other', 'zzz', false).split(';')[0]}`;
    expect(readBinder(header, 'st')).toBe('abc');
    expect(readBinder(header, 'other')).toBe('zzz');
    expect(readBinder(header, 'third')).toBeNull();
    expect(readBinder('a=1', 'st')).toBeNull();
    expect(readBinder(undefined, 'st')).toBeNull();
    expect(readBinder(header, null)).toBeNull();
    expect(binderCookieName('st')).not.toBe(binderCookieName('other'));
  });
});
