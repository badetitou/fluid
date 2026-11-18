import { describe, expect, it } from 'vitest';
import { authServerMetadataSchema, endpointsAllowed, metadataCandidates, resourceMatches } from './oauth';

describe('metadata candidates', () => {
  it('follows the MCP order, with path insertion for issuers that have a path', () => {
    expect(metadataCandidates('https://a.test')).toEqual([
      'https://a.test/.well-known/oauth-authorization-server',
      'https://a.test/.well-known/openid-configuration',
    ]);
    expect(metadataCandidates('https://a.test/t1/')).toEqual([
      'https://a.test/.well-known/oauth-authorization-server/t1',
      'https://a.test/.well-known/openid-configuration/t1',
      'https://a.test/t1/.well-known/openid-configuration',
    ]);
  });
});

describe('discovery rules', () => {
  it('requires https endpoints for an https issuer, anything for an http one', () => {
    expect(endpointsAllowed('https://i.test', ['https://i.test/a', 'https://other.test/t'])).toBe(true);
    expect(endpointsAllowed('https://i.test', ['https://i.test/a', 'http://i.test/t'])).toBe(false);
    expect(endpointsAllowed('http://127.0.0.1:1', ['http://127.0.0.1:1/t'])).toBe(true);
    expect(endpointsAllowed('HTTPS://i.test', ['HTTPS://i.test/a'])).toBe(true);
    expect(endpointsAllowed('https://i.test', ['not a url'])).toBe(false);
    expect(endpointsAllowed('https://i.test', ['https:/\\x', 'httpx://i.test'])).toBe(false);
  });

  it('matches a protected resource against the probed URL', () => {
    expect(resourceMatches('https://api.test', 'https://api.test/graphql')).toBe(true);
    expect(resourceMatches('https://api.test/graphql', 'https://api.test/graphql')).toBe(true);
    expect(resourceMatches('https://api.test/v2', 'https://api.test/graphql')).toBe(false);
    expect(resourceMatches('https://evil.test', 'https://api.test/graphql')).toBe(false);
    expect(resourceMatches('nonsense', 'https://api.test/graphql')).toBe(false);
  });

  it('reads only http(s) endpoints from the metadata', () => {
    const ok = { authorization_endpoint: 'https://i.test/a', token_endpoint: 'https://i.test/t' };
    expect(authServerMetadataSchema.safeParse(ok).success).toBe(true);
    expect(authServerMetadataSchema.safeParse({ ...ok, token_endpoint: 'javascript:alert(1)' }).success).toBe(false);
  });
});
