import { Client } from '@urql/core';
import type { ViewPayload } from './toolResult';
import { ViewerData, type RunQueriesFn } from './viewerData';
import { viewerExchange, type InvokeMutationFn } from './viewerExchange';

/** A urql client that never touches the network: the url is a placeholder no exchange reads. */
export function createViewerClient(payload: ViewPayload, run: RunQueriesFn, invoke?: InvokeMutationFn): Client {
  const data = new ViewerData(payload.spec, payload.data, payload.take, run);
  return new Client({ url: 'mcp-app://viewer', exchanges: [viewerExchange(data, invoke)], requestPolicy: 'network-only' });
}
