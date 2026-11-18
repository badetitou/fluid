import { describe, expect, it } from 'vitest';
import { loggedUrl } from './log';

describe('loggedUrl', () => {
  it('drops the query of the OAuth callback only', () => {
    expect(loggedUrl('/api/oauth/callback?code=abc&state=xyz')).toBe('/api/oauth/callback');
    expect(loggedUrl('/api/views?x=1')).toBe('/api/views?x=1');
  });
});
