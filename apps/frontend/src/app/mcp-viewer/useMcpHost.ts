import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemeMode } from '../../shared/theme';
import { HostBridge } from './bridge';
import { parseRunResult, parseToolResult, type ParsedToolResult } from './toolResult';

export interface McpHost {
  /** The view (or error) the host last sent; undefined until the first tool result. */
  shown?: ParsedToolResult;
  /** The host's light or dark context, once known. */
  hostTheme?: ThemeMode;
  /** Runs `run_queries` on the host for the shown view; rejects with the tool's error. */
  runQueries: (args: { take?: number; variables?: Record<string, unknown> }) => Promise<ReturnType<typeof parseRunResult>>;
  reportSize: (size: { width: number; height: number }) => void;
}

const APP_INFO = { name: 'fluid-mcp-app-viewer', version: '1.0.0' };

/** Connects to the host frame (MCP Apps handshake) and exposes what it sends. */
export function useMcpHost(): McpHost {
  const [shown, setShown] = useState<ParsedToolResult>();
  const [hostTheme, setHostTheme] = useState<ThemeMode>();
  const [bridge, setBridge] = useState<HostBridge>();

  useEffect(() => {
    const next = new HostBridge(window.parent, {
      onToolResult: (params) => setShown(parseToolResult(params)),
      onHostContext: (context) => context.theme && setHostTheme(context.theme),
    });
    const listener = (event: MessageEvent) => next.handle(event);
    window.addEventListener('message', listener);
    setBridge(next);
    next.connect(APP_INFO).catch((err: unknown) => setShown({ kind: 'error', message: `Could not reach the host: ${String(err)}` }));
    return () => window.removeEventListener('message', listener);
  }, []);

  const viewId = shown?.kind === 'view' ? shown.payload.viewId : undefined;
  const sourceId = shown?.kind === 'view' ? shown.payload.sourceId : undefined;

  const runQueries = useCallback<McpHost['runQueries']>(
    async (args) => {
      if (!bridge || !viewId || !sourceId) throw new Error('Not connected to the host.');
      return parseRunResult(await bridge.callTool('run_queries', { viewId, sourceId, ...args }));
    },
    [bridge, viewId, sourceId],
  );
  const reportSize = useCallback<McpHost['reportSize']>((size) => bridge?.reportSize(size), [bridge]);

  return useMemo(() => ({ shown, hostTheme, runQueries, reportSize }), [shown, hostTheme, runQueries, reportSize]);
}
