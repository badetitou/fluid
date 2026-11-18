import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthRequired } from './authRequired';

const state = () => useAuthRequired.getState();

describe('auth required store', () => {
  beforeEach(() => useAuthRequired.setState({ required: {}, failing: {}, epoch: {} }));

  it('remembers why a source needs a sign-in, per source', () => {
    state().report('a', { reason: 'expired' }, 'q1');
    state().report('b', { reason: 'insufficient_scope', scope: 'write' }, 'q1');
    expect(state().required).toEqual({ a: { reason: 'expired' }, b: { reason: 'insufficient_scope', scope: 'write' } });
  });

  it('keeps the same state for a repeated report', () => {
    state().report('a', { reason: 'expired' }, 'q1');
    const before = state();
    state().report('a', { reason: 'expired' }, 'q1');
    expect(state().required).toBe(before.required);
    expect(state().failing).toBe(before.failing);
  });

  it('keeps the prompt while another operation still fails, and drops it with the last one', () => {
    state().report('a', { reason: 'expired' }, 'q1');
    state().report('a', { reason: 'expired' }, 'q2');
    state().succeeded('a', 'q3');
    state().succeeded('a', 'q1');
    expect(state().required).toEqual({ a: { reason: 'expired' } });
    state().succeeded('a', 'q2');
    expect(state().required).toEqual({});
    expect(state().failing).toEqual({});
    expect(state().epoch).toEqual({});
  });

  it('restarts the client of a source whose credential changed', () => {
    state().report('a', { reason: 'expired' }, 'q1');
    state().reconnected('a');
    state().reconnected('a');
    expect(state().required).toEqual({});
    expect(state().failing).toEqual({});
    expect(state().epoch).toEqual({ a: 2 });
  });
});
