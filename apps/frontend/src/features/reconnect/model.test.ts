import { describe, expect, it } from 'vitest';
import { reconnectMessage } from './model';

describe('reconnectMessage', () => {
  it('tells why, by reason', () => {
    expect(reconnectMessage({ reason: 'expired' })).toMatch(/expired/);
    expect(reconnectMessage({ reason: 'signin' })).toMatch(/sign in/);
    expect(reconnectMessage({ reason: 'insufficient_scope', scope: 'write' })).toMatch(/“write”/);
    expect(reconnectMessage({ reason: 'insufficient_scope' })).toMatch(/more access/);
  });
});
