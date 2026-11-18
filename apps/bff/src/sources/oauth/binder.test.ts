import { describe, expect, it } from 'vitest';
import { binderMatches, hashBinder, newBinder, readBinder, setBinderCookie } from './binder';

describe('binder cookie', () => {
  it('matches only the binder it was derived from', () => {
    const b = newBinder();
    expect(binderMatches(hashBinder(b), b)).toBe(true);
    expect(binderMatches(hashBinder(b), newBinder())).toBe(false);
    expect(binderMatches(hashBinder(b), null)).toBe(false);
  });

  it('sets an HttpOnly, SameSite=Lax cookie on the oauth path and reads it back', () => {
    const cookie = setBinderCookie('abc', true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/oauth');
    expect(cookie).toContain('Secure');
    expect(setBinderCookie('abc', false)).not.toContain('Secure');
    expect(readBinder('a=1; fluid_oauth=abc; b=2')).toBe('abc');
    expect(readBinder('a=1')).toBeNull();
    expect(readBinder(undefined)).toBeNull();
  });
});
