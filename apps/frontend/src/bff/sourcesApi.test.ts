import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./http', () => http);

import { sourcesApi } from './sourcesApi';

beforeEach(() => vi.resetAllMocks());

describe('sourcesApi OAuth calls', () => {
  it('encodes the discovery query, leaving out what is not given', async () => {
    http.request.mockResolvedValue({ suggestion: { issuer: 'https://as', scopes: [], resource: null }, authorizationServer: null });
    await sourcesApi.discover({ url: 'https://api.example.com/graphql?a=b&c', issuer: 'https://as' });
    expect(http.request).toHaveBeenLastCalledWith(
      '/api/oauth/discover?url=https%3A%2F%2Fapi.example.com%2Fgraphql%3Fa%3Db%26c&issuer=https%3A%2F%2Fas',
    );
    await sourcesApi.discover({ url: 'https://api.example.com/graphql' });
    expect(http.request).toHaveBeenLastCalledWith('/api/oauth/discover?url=https%3A%2F%2Fapi.example.com%2Fgraphql');
  });

  it('checks the discovery answer', async () => {
    http.request.mockResolvedValue({ suggestion: { issuer: 3 } });
    await expect(sourcesApi.discover({ url: 'https://x' })).rejects.toThrow();
  });

  it('signs out with a DELETE of the source credential, id encoded', async () => {
    http.request.mockResolvedValue(undefined);
    await sourcesApi.signOut('a b/c');
    expect(http.request).toHaveBeenCalledWith('/api/sources/a%20b%2Fc/oauth/credential', { method: 'DELETE' });
  });

  it('reads the public OAuth state of a config', async () => {
    http.request.mockResolvedValue({
      id: 's',
      name: 'n',
      url: 'https://x',
      authKind: 'oauth',
      headerName: null,
      hasSecret: false,
      oauth: {
        issuer: 'https://as',
        clientId: 'c',
        hasClientSecret: true,
        scopes: ['read'],
        resource: null,
        signedIn: true,
        expiresAt: '2030-01-01T00:00:00.000Z',
        grantedScopes: ['read'],
      },
    });
    const config = await sourcesApi.get('s');
    expect(config.oauth?.signedIn).toBe(true);
  });
});
