import { describe, expect, it } from 'vitest';
import { authFormOf, authPatch, bffSourceName } from './bffAuth';

describe('auth form', () => {
  it('starts from the stored config without any secret, header defaulting to Authorization', () => {
    expect(authFormOf(null)).toEqual({ authKind: 'none', headerName: 'Authorization', secret: '' });
    expect(authFormOf({ authKind: 'header', headerName: 'X-Api-Key' })).toEqual({
      authKind: 'header',
      headerName: 'X-Api-Key',
      secret: '',
    });
  });

  it('removes header and secret when auth is none', () => {
    expect(authPatch({ authKind: 'none', headerName: 'X', secret: 'typed' })).toEqual({
      authKind: 'none',
      headerName: null,
      secret: null,
    });
  });

  it('sends the secret only when typed (else the stored one is kept)', () => {
    expect(authPatch({ authKind: 'header', headerName: ' X-Key ', secret: ' tok ' })).toEqual({
      authKind: 'header',
      headerName: 'X-Key',
      secret: 'tok',
    });
    const kept = authPatch({ authKind: 'header', headerName: '', secret: '' });
    expect(kept).toEqual({ authKind: 'header', headerName: 'Authorization' });
    expect('secret' in kept).toBe(false);
  });
});

describe('bffSourceName', () => {
  it('prefers the given name, then the host, then the raw URL', () => {
    expect(bffSourceName('https://api.github.com/graphql', ' GitHub ')).toBe('GitHub');
    expect(bffSourceName('https://api.github.com/graphql')).toBe('api.github.com');
    expect(bffSourceName('not a url')).toBe('not a url');
  });
});
