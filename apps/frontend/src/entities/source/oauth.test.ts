import { describe, expect, it } from 'vitest';
import { authRequiredOf, bffOrigin, oauthStartUrl, readOAuthMessage, signInHint } from './oauth';

describe('oauthStartUrl', () => {
  it('points at the BFF start route with the UI origin, and the extra scope when asked', () => {
    expect(oauthStartUrl('http://localhost:4001/', 'a b', 'http://localhost:5173')).toBe(
      'http://localhost:4001/api/sources/a%20b/oauth/start?origin=http%3A%2F%2Flocalhost%3A5173',
    );
    expect(oauthStartUrl('', 's1', 'https://fluid.example', 'write admin')).toBe(
      '/api/sources/s1/oauth/start?origin=https%3A%2F%2Ffluid.example&scope=write+admin',
    );
  });
});

describe('bffOrigin', () => {
  it('is the BFF base origin, or the page origin for a same-origin BFF', () => {
    expect(bffOrigin('http://localhost:4001', 'http://localhost:5173')).toBe('http://localhost:4001');
    expect(bffOrigin('', 'https://fluid.example')).toBe('https://fluid.example');
    expect(bffOrigin('not a url', 'https://fluid.example')).toBeNull();
  });
});

describe('readOAuthMessage', () => {
  const origin = 'http://localhost:4001';
  const good = { type: 'fluid-oauth', sourceId: 's1', ok: true };

  it('accepts the BFF message of this source', () => {
    expect(readOAuthMessage({ origin, data: good }, origin, 's1')).toEqual({ ok: true });
    expect(readOAuthMessage({ origin, data: { ...good, ok: false } }, origin, 's1')).toEqual({ ok: false });
  });

  it('ignores another origin, another source, or anything not of that shape', () => {
    expect(readOAuthMessage({ origin: 'https://evil.example', data: good }, origin, 's1')).toBeNull();
    expect(readOAuthMessage({ origin, data: good }, null, 's1')).toBeNull();
    expect(readOAuthMessage({ origin, data: { ...good, sourceId: 's2' } }, origin, 's1')).toBeNull();
    expect(readOAuthMessage({ origin, data: { ...good, sourceId: null } }, origin, 's1')).toBeNull();
    expect(readOAuthMessage({ origin, data: { ...good, type: 'other' } }, origin, 's1')).toBeNull();
    expect(readOAuthMessage({ origin, data: { type: 'fluid-oauth', sourceId: 's1', ok: 'yes' } }, origin, 's1')).toBeNull();
    expect(readOAuthMessage({ origin, data: 'fluid-oauth' }, origin, 's1')).toBeNull();
  });
});

describe('authRequiredOf', () => {
  it('finds the FLUID_AUTH_REQUIRED error with its reason and scope', () => {
    const errors = [
      { message: 'other' },
      { message: 'x', extensions: { code: 'FLUID_AUTH_REQUIRED', reason: 'insufficient_scope', scope: 'write' } },
    ];
    expect(authRequiredOf(errors)).toEqual({ reason: 'insufficient_scope', scope: 'write' });
    expect(authRequiredOf([{ extensions: { code: 'FLUID_AUTH_REQUIRED', reason: 'expired' } }])).toEqual({ reason: 'expired' });
  });

  it('falls back to a plain sign-in for an unknown reason, and ignores other errors', () => {
    expect(authRequiredOf([{ extensions: { code: 'FLUID_AUTH_REQUIRED', reason: 'weird', scope: 3 } }])).toEqual({ reason: 'signin' });
    expect(authRequiredOf([{ extensions: { code: 'BAD_USER_INPUT' } }, { extensions: 'x' }, {}])).toBeNull();
    expect(authRequiredOf(undefined)).toBeNull();
  });
});

describe('signInHint', () => {
  it('says something for each unfinished state and nothing when idle', () => {
    expect(signInHint('idle')).toBeNull();
    for (const s of ['waiting', 'blocked', 'closed', 'failed'] as const) expect(signInHint(s)).toBeTruthy();
    expect(signInHint('blocked')).toMatch(/pop-up/);
  });
});
