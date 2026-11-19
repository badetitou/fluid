import { describe, expect, it } from 'vitest';
import { authHeaders, createSourceBody, toPublicSource, updateSourceBody } from './model';

const record = {
  id: 'a',
  name: 'n',
  url: 'https://x.test/graphql',
  authKind: 'header',
  headerName: null,
  secret: 'ENCRYPTED',
  authGeneration: 0,
  allowWrites: false,
  oauthIssuer: null,
  oauthClientId: null,
  oauthClientSecret: null,
  oauthScopes: null,
  oauthResource: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('source model', () => {
  it('never serializes the secret', () => {
    const json = JSON.stringify(toPublicSource(record));
    expect(json).not.toContain('ENCRYPTED');
    expect(toPublicSource(record)).toMatchObject({ hasSecret: true, headerName: 'Authorization' });
    expect(toPublicSource({ ...record, secret: null }).hasSecret).toBe(false);
  });
  it('builds Bearer for Authorization and raw for other headers', () => {
    expect(authHeaders(record, 's3')).toEqual({ Authorization: 'Bearer s3' });
    expect(authHeaders({ authKind: 'header', headerName: 'X-Api-Key' }, 's3')).toEqual({ 'X-Api-Key': 's3' });
    expect(authHeaders({ authKind: 'none', headerName: null }, 's3')).toEqual({});
  });
  it('accepts only http(s) urls and sane headers', () => {
    expect(createSourceBody.safeParse({ name: 'a', url: 'file:///etc/passwd' }).success).toBe(false);
    expect(createSourceBody.safeParse({ name: 'a', url: 'ftp://x' }).success).toBe(false);
    expect(createSourceBody.safeParse({ name: 'a', url: 'http://localhost:1/g' }).success).toBe(true);
    expect(createSourceBody.safeParse({ name: 'a', url: 'https://x', headerName: 'A\r\nB: c' }).success).toBe(false);
    expect(createSourceBody.safeParse({ name: 'a', url: 'https://x', secret: 'a\nb' }).success).toBe(false);
    expect(updateSourceBody.safeParse({}).success).toBe(false);
  });
  it('rejects reserved header names, case-insensitively', () => {
    for (const h of ['Content-Type', 'ACCEPT', 'host', 'Content-Length', 'Transfer-Encoding', 'Connection', 'Keep-Alive', 'Upgrade', 'TE', 'Trailer', 'Proxy-Authorization']) {
      expect(createSourceBody.safeParse({ name: 'a', url: 'https://x', headerName: h }).success, h).toBe(false);
    }
    expect(createSourceBody.safeParse({ name: 'a', url: 'https://x', headerName: 'X-Api-Key' }).success).toBe(true);
  });
});
