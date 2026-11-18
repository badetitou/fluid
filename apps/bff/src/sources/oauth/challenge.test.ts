import { describe, expect, it } from 'vitest';
import { parseBearerChallenge } from './challenge';

describe('bearer challenge', () => {
  it('reads resource_metadata, error and scope', () => {
    expect(
      parseBearerChallenge('Bearer resource_metadata="https://r.test/.well-known/oauth-protected-resource", scope="a b"'),
    ).toEqual({ resourceMetadata: 'https://r.test/.well-known/oauth-protected-resource', scope: 'a b' });
    expect(parseBearerChallenge('Bearer error="insufficient_scope", scope="write"')).toEqual({
      error: 'insufficient_scope',
      scope: 'write',
    });
  });

  it('accepts bare tokens and escaped quotes, and ignores other schemes or no header', () => {
    expect(parseBearerChallenge('Bearer error=invalid_token')).toEqual({ error: 'invalid_token' });
    expect(parseBearerChallenge('Bearer scope="a \\"b\\""')).toEqual({ scope: 'a "b"' });
    expect(parseBearerChallenge('Basic realm="x"')).toEqual({});
    expect(parseBearerChallenge(null)).toEqual({});
    expect(parseBearerChallenge('')).toEqual({});
  });
});
