import { describe, expect, it, vi } from 'vitest';
import { HostBridge, PROTOCOL_VERSION } from './bridge';

function setup() {
  const host = { postMessage: vi.fn() };
  const handlers = { onToolResult: vi.fn(), onHostContext: vi.fn() };
  const bridge = new HostBridge(host, handlers);
  const sent = () => host.postMessage.mock.calls.map((c) => c[0] as Record<string, unknown>);
  return { host, handlers, bridge, sent };
}

describe('HostBridge', () => {
  it('ignores messages that do not come from the parent frame', () => {
    const { bridge, handlers } = setup();
    bridge.handle({ source: {}, data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {} } });
    expect(handlers.onToolResult).not.toHaveBeenCalled();
  });

  it('ignores messages that are not JSON-RPC', () => {
    const { bridge, host, handlers } = setup();
    for (const data of ['x', null, { method: 'ui/notifications/tool-result' }, { jsonrpc: '1.0' }]) bridge.handle({ source: host, data });
    expect(handlers.onToolResult).not.toHaveBeenCalled();
  });

  it('hands tool results and host context changes to the handlers', () => {
    const { bridge, host, handlers } = setup();
    const params = { structuredContent: { a: 1 } };
    bridge.handle({ source: host, data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'pink' } } });
    expect(handlers.onToolResult).toHaveBeenCalledWith(params);
    expect(handlers.onHostContext).toHaveBeenCalledTimes(1);
    expect(handlers.onHostContext).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('does the handshake: initialize, apply the host context, then initialized', async () => {
    const { bridge, host, handlers, sent } = setup();
    const done = bridge.connect({ name: 'v', version: '1' });
    const [init] = sent();
    expect(init).toMatchObject({ method: 'ui/initialize', params: { protocolVersion: PROTOCOL_VERSION } });
    expect(sent()).toHaveLength(1);
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: init.id, result: { hostContext: { theme: 'dark' } } } });
    await done;
    expect(handlers.onHostContext).toHaveBeenCalledWith({ theme: 'dark' });
    expect(sent()[1]).toMatchObject({ method: 'ui/notifications/initialized' });
  });

  it('resolves a tools/call with its result and rejects on an error', async () => {
    const { bridge, host, sent } = setup();
    const ok = bridge.callTool('run_queries', { viewId: 'v' });
    expect(sent()[0]).toMatchObject({ method: 'tools/call', params: { name: 'run_queries', arguments: { viewId: 'v' } } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: sent()[0].id, result: { content: [] } } });
    await expect(ok).resolves.toEqual({ content: [] });
    const bad = bridge.callTool('run_queries', {});
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: sent()[1].id, error: { message: 'nope' } } });
    await expect(bad).rejects.toThrow('nope');
  });

  it('answers ping and teardown, and refuses unknown requests', () => {
    const { bridge, host, sent } = setup();
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: 7, method: 'ui/resource-teardown', params: {} } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: 8, method: 'other' } });
    expect(sent()[0]).toMatchObject({ id: 7, result: {} });
    expect(sent()[1]).toMatchObject({ id: 8, error: { code: -32601 } });
  });

  it('reports its size as a notification', () => {
    const { bridge, sent } = setup();
    bridge.reportSize({ width: 400, height: 300 });
    expect(sent()[0]).toMatchObject({ method: 'ui/notifications/size-changed', params: { width: 400, height: 300 } });
  });
});
