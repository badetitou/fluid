import { describe, expect, it, vi } from 'vitest';
import { parseViewSpec } from '@fluid/shared';
import { Client, gql } from '@urql/core';
import { SPEC } from './fixtures';
import { ViewerData } from './viewerData';
import { viewerExchange } from './viewerExchange';

const spec = parseViewSpec(SPEC);

function client(run = vi.fn()) {
  const data = new ViewerData(spec, { list: { data: { characters: [{ id: '1' }] } } }, 100, run);
  return { run, client: new Client({ url: 'mcp-app://viewer', exchanges: [viewerExchange(data)], requestPolicy: 'network-only' }) };
}

describe('viewerExchange', () => {
  it('answers a stored query without any call', async () => {
    const { client: c, run } = client();
    const res = await c.query(gql(spec.queries.list.query), { take: 100 }).toPromise();
    expect(res.data).toEqual({ characters: [{ id: '1' }] });
    expect(run).not.toHaveBeenCalled();
  });

  it('answers an unknown query with an error', async () => {
    const { client: c } = client();
    const res = await c.query('query { nope }', {}).toPromise();
    expect(res.error?.message).toContain('not part of the view');
  });

  it('refuses a mutation without running anything', async () => {
    const { client: c, run } = client();
    const res = await c.mutation('mutation { doIt }', {}).toPromise();
    expect(res.error?.message).toContain('not available in this host');
    expect(run).not.toHaveBeenCalled();
  });

  it('turns a failed refetch into an error result', async () => {
    const { client: c } = client(vi.fn().mockRejectedValue(new Error('too large')));
    const res = await c.query(gql(spec.queries.list.query), { take: 900 }).toPromise();
    expect(res.error?.message).toContain('too large');
  });
});
