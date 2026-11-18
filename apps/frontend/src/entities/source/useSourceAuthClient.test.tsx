import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Client, fetchExchange } from 'urql';
import { useConnection } from '../../store';
import { useAuthRequired } from './authRequired';
import { useSavedSources } from './store';
import { authRequiredExchange, useSourceAuthClient } from './useSourceAuthClient';

const URL_ = 'https://api.example.com/graphql';
const authError = { errors: [{ message: 'expired', extensions: { code: 'FLUID_AUTH_REQUIRED', reason: 'expired' } }] };

/** A urql client over a fake network: `answers[query name]` is the JSON body of the 401 / 200. */
function clientWith(answers: Record<string, unknown>, epoch = 0) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      // urql sends short queries as a GET (the query in the URL), the others as a POST.
      const sent = decodeURIComponent(`${url} ${String(init.body)}`);
      const name = Object.keys(answers).find((n) => sent.includes(n)) ?? '';
      const body = answers[name];
      const failed = typeof body === 'object' && body !== null && 'errors' in body;
      return new Response(JSON.stringify(body), { status: failed ? 401 : 200, headers: { 'content-type': 'application/json' } });
    }),
  );
  return new Client({ url: 'http://bff/graphql', exchanges: [authRequiredExchange('a', epoch), fetchExchange] });
}
const run = (client: Client, name: string) =>
  client.query(`query ${name} { x }`, {}, { requestPolicy: 'network-only' }).toPromise();

beforeEach(() => {
  useAuthRequired.setState({ required: {}, failing: {}, epoch: {} });
  useSavedSources.setState({ saved: [{ url: URL_, bffSourceId: 'a' }] });
  useConnection.setState({ graphqlUrl: URL_ });
});
afterEach(() => vi.unstubAllGlobals());

describe('authRequiredExchange', () => {
  it('reports the FLUID_AUTH_REQUIRED error of an answer', async () => {
    const client = clientWith({ Q1: authError });
    await run(client, 'Q1');
    expect(useAuthRequired.getState().required).toEqual({ a: { reason: 'expired' } });
  });

  it('keeps the prompt while another query still fails, and drops it when the last one works', async () => {
    const answers: Record<string, unknown> = { Q1: authError, Q2: { data: { x: 1 } } };
    const client = clientWith(answers);
    await run(client, 'Q1');
    await run(client, 'Q2');
    expect(useAuthRequired.getState().required).toEqual({ a: { reason: 'expired' } });

    answers.Q1 = { data: { x: 1 } };
    await run(client, 'Q1');
    expect(useAuthRequired.getState().required).toEqual({});
  });

  it('ignores answers of a client older than the last sign-in', async () => {
    useAuthRequired.setState({ epoch: { a: 1 } });
    await run(clientWith({ Q1: authError }, 0), 'Q1');
    expect(useAuthRequired.getState().required).toEqual({});
  });
});

describe('useSourceAuthClient', () => {
  it('gives an exchange for a BFF source, a new one after each sign-in, none for a direct source', () => {
    const { result, rerender } = renderHook(() => useSourceAuthClient());
    const first = result.current;
    expect(first).not.toBeNull();
    rerender();
    expect(result.current).toBe(first);

    act(() => useAuthRequired.getState().reconnected('a'));
    expect(result.current).not.toBeNull();
    expect(result.current).not.toBe(first);

    act(() => useSavedSources.setState({ saved: [{ url: URL_ }] }));
    expect(result.current).toBeNull();
  });
});
