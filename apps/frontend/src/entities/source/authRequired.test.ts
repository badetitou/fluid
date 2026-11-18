import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthRequired } from './authRequired';

const state = () => useAuthRequired.getState();

describe('auth required store', () => {
  beforeEach(() => useAuthRequired.setState({ required: {}, epoch: {} }));

  it('remembers why a source needs a sign-in, per source', () => {
    state().report('a', { reason: 'expired' });
    state().report('b', { reason: 'insufficient_scope', scope: 'write' });
    expect(state().required).toEqual({ a: { reason: 'expired' }, b: { reason: 'insufficient_scope', scope: 'write' } });
  });

  it('keeps the same state object for a repeated report', () => {
    state().report('a', { reason: 'expired' });
    const before = state().required;
    state().report('a', { reason: 'expired' });
    expect(state().required).toBe(before);
  });

  it('clears the prompt without restarting the client', () => {
    state().report('a', { reason: 'signin' });
    state().clear('a');
    expect(state().required).toEqual({});
    expect(state().epoch).toEqual({});
  });

  it('restarts the client of a source that signed in again', () => {
    state().report('a', { reason: 'expired' });
    state().reconnected('a');
    state().reconnected('a');
    expect(state().required).toEqual({});
    expect(state().epoch).toEqual({ a: 2 });
  });
});
