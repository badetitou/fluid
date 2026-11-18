import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, fetchExchange } from 'urql';
import { useAuthRequired } from '../authRequired';
import { browserAuthExchange } from './exchange';
import { browserAuthKey, settingsFingerprint, type BrowserOAuthSettings } from './model';
import { useBrowserOAuthSettings, useBrowserTokens } from './store';

const SOURCE = 'https://api.test/graphql';
const KEY = browserAuthKey(SOURCE);
const settings: BrowserOAuthSettings = { issuer: 'https://as.test', clientId: 'fluid', scopes: [] };
const token = (expiresAt: number | null = null) => ({
  accessToken: 'AT',
  expiresAt,
  scope: null,
  fingerprint: settingsFingerprint(settings),
});

/** A urql client over a fake network answering `status`; returns the headers each request carried. */
function clientFor(url: string, status: number) {
  const seen: Headers[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(new Headers(init.headers));
      const body = status === 200 ? { data: { x: 1 } } : { message: 'unauthorized' };
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }),
  );
  const client = new Client({ url, exchanges: [browserAuthExchange(SOURCE, 0), fetchExchange], preferGetMethod: false });
  const run = (name = 'Q') => client.query(`query ${name} { x }`, {}, { requestPolicy: 'network-only' }).toPromise();
  return { seen, run };
}

beforeEach(() => {
  useAuthRequired.setState({ required: {}, failing: {}, epoch: {} });
  useBrowserOAuthSettings.setState({ byUrl: { [SOURCE]: settings } });
  useBrowserTokens.setState({ byUrl: {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('browserAuthExchange', () => {
  it('sends the in-memory token as a Bearer header to the source', async () => {
    useBrowserTokens.setState({ byUrl: { [SOURCE]: token() } });
    const { seen, run } = clientFor(SOURCE, 200);
    await run();
    expect(seen[0].get('authorization')).toBe('Bearer AT');
  });

  it('sends no token to another URL, nor an expired one', async () => {
    useBrowserTokens.setState({ byUrl: { [SOURCE]: token() } });
    const other = clientFor('https://other.test/graphql', 200);
    await other.run();
    expect(other.seen[0].get('authorization')).toBeNull();

    useBrowserTokens.setState({ byUrl: { [SOURCE]: token(1) } });
    const expired = clientFor(SOURCE, 200);
    await expired.run();
    expect(expired.seen[0].get('authorization')).toBeNull();
  });

  it('asks to sign in on a 401, as expired when a token was held, and stops once a query works', async () => {
    const first = clientFor(SOURCE, 401);
    await first.run('A');
    expect(useAuthRequired.getState().required[KEY]).toEqual({ reason: 'signin' });

    useBrowserTokens.setState({ byUrl: { [SOURCE]: token() } });
    await clientFor(SOURCE, 401).run('B');
    expect(useAuthRequired.getState().required[KEY]).toEqual({ reason: 'expired' });

    const ok = clientFor(SOURCE, 200);
    await ok.run('A');
    await ok.run('B');
    expect(useAuthRequired.getState().required[KEY]).toBeUndefined();
  });

  it('ignores answers of an older epoch', async () => {
    useAuthRequired.setState({ epoch: { [KEY]: 1 } });
    await clientFor(SOURCE, 401).run();
    expect(useAuthRequired.getState().required[KEY]).toBeUndefined();
  });
});
