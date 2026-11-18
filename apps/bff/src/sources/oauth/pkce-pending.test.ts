import { describe, expect, it } from 'vitest';
import { createPendingStore, type PendingSignIn } from './pkce-pending';

const entry = (state: string, sourceId = 'x', createdAt = 0): PendingSignIn => ({
  state,
  verifier: 'v',
  nonce: 'n',
  sourceId,
  redirectUri: 'r',
  uiOrigin: 'https://ui.test',
  scopes: [],
  binderHash: 'h',
  fingerprint: 'f',
  oidc: false,
  createdAt,
});

describe('pending sign-ins', () => {
  it('is single use', () => {
    const store = createPendingStore(1000, () => 0);
    store.add(entry('s'));
    expect(store.take('s')?.verifier).toBe('v');
    expect(store.take('s')).toBeNull();
    expect(store.take('unknown')).toBeNull();
  });

  it('expires after the TTL', () => {
    let t = 0;
    const store = createPendingStore(1000, () => t);
    store.add(entry('s'));
    t = 999;
    expect(store.take('s')).not.toBeNull();
    store.add(entry('s', 'x', 0));
    t = 1000;
    expect(store.take('s')).toBeNull();
  });

  it('is bounded: the oldest entry goes first', () => {
    const store = createPendingStore(1000, () => 0, 2);
    store.add(entry('a'));
    store.add(entry('b'));
    store.add(entry('c'));
    expect(store.size()).toBe(2);
    expect(store.take('a')).toBeNull();
    expect(store.take('c')).not.toBeNull();
  });

  it('forgets the sign-ins of one source', () => {
    const store = createPendingStore(1000, () => 0);
    store.add(entry('a', 'one'));
    store.add(entry('b', 'two'));
    store.dropForSource('one');
    expect(store.take('a')).toBeNull();
    expect(store.take('b')).not.toBeNull();
  });
});
