import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostBridge, INITIALIZE_TIMEOUT_MS, PROTOCOL_VERSION, TOOL_TIMEOUT_MS } from './bridge';

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
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: 7, method: 'ping', params: {} } });
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

describe('HostBridge robustness', () => {
  afterEach(() => vi.useRealTimers());

  it('posts JSON-RPC 2.0 with target origin *', () => {
    const { bridge, host } = setup();
    bridge.notify('x');
    expect(host.postMessage).toHaveBeenCalledWith({ jsonrpc: '2.0', method: 'x', params: undefined }, '*');
  });

  it('ignores answers to unknown or settled ids, and responses with neither result nor error', async () => {
    const { bridge, host, sent } = setup();
    const call = bridge.callTool('t', {});
    const id = sent()[0].id;
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: 999, result: {} } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id, result: 'first' } });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id, result: 'second' } });
    await expect(call).resolves.toBe('first');
  });

  it('rejects connect on an initialize error and never says initialized', async () => {
    const { bridge, host, sent } = setup();
    const done = bridge.connect({ name: 'v', version: '1' });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: sent()[0].id, error: { message: 'no' } } });
    await expect(done).rejects.toThrow('no');
    expect(sent().some((m) => m.method === 'ui/notifications/initialized')).toBe(false);
  });

  it('ignores a malformed host context', async () => {
    const { bridge, host, sent, handlers } = setup();
    const done = bridge.connect({ name: 'v', version: '1' });
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: sent()[0].id, result: { hostContext: { theme: 3 } } } });
    await done;
    expect(handlers.onHostContext).not.toHaveBeenCalled();
  });

  it('rejects a request the host never answers, with the timeout of its kind', async () => {
    vi.useFakeTimers();
    const { bridge, host, sent } = setup();
    const init = bridge.connect({ name: 'v', version: '1' });
    const initFailed = expect(init).rejects.toThrow('ui/initialize');
    await vi.advanceTimersByTimeAsync(INITIALIZE_TIMEOUT_MS);
    await initFailed;
    const call = bridge.callTool('t', {});
    const failed = expect(call).rejects.toThrow('tools/call');
    await vi.advanceTimersByTimeAsync(TOOL_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    // A late answer is ignored.
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: sent()[1].id, result: {} } });
  });

  it('dispose rejects what is pending, and stops reading and sending requests', async () => {
    const { bridge, host, handlers } = setup();
    const call = bridge.callTool('t', {});
    bridge.dispose();
    await expect(call).rejects.toThrow('closed');
    await expect(bridge.callTool('t', {})).rejects.toThrow('closed');
    bridge.handle({ source: host, data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {} } });
    expect(handlers.onToolResult).not.toHaveBeenCalled();
  });

  it('the teardown request is answered, then the bridge is closed', async () => {
    const { bridge, host, sent } = setup();
    const call = bridge.callTool('t', {});
    bridge.handle({ source: host, data: { jsonrpc: '2.0', id: 7, method: 'ui/resource-teardown' } });
    expect(sent()[1]).toMatchObject({ id: 7, result: {} });
    await expect(call).rejects.toThrow('closed');
  });
});
