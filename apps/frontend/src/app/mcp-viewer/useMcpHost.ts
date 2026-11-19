import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemeMode } from '../../shared/theme';
import { HostBridge } from './bridge';
import { parseRunResult, parseToolResult, type ViewPayload } from './toolResult';

export interface McpHost {
  /** The last good view the host sent; a later failing result does not replace it. */
  view?: ViewPayload;
  /** What went wrong last (a failing tool result, or the host connection), until a good result arrives. */
  error?: string;
  /** The host's light or dark context, once known. */
  hostTheme?: ThemeMode;
  /** Runs `run_queries` on the host for the shown view; rejects with the tool's error. */
  runQueries: (args: { take?: number; variables?: Record<string, unknown> }) => Promise<ReturnType<typeof parseRunResult>>;
  /** Tells the host the content size; does nothing until the handshake is done. */
  reportSize: (size: { width: number; height: number }) => void;
}

const APP_INFO = { name: 'fluid-mcp-app-viewer', version: '1.0.0' };

/** Connects to the host frame (MCP Apps handshake) and exposes what it sends. */
export function useMcpHost(): McpHost {
  const [view, setView] = useState<ViewPayload>();
  const [error, setError] = useState<string>();
  const [hostTheme, setHostTheme] = useState<ThemeMode>();
  // Set once `ui/notifications/initialized` is sent: nothing else is posted before.
  const [bridge, setBridge] = useState<HostBridge>();

  useEffect(() => {
    const next = new HostBridge(window.parent, {
      onToolResult: (params) => {
        const parsed = parseToolResult(params);
        if (parsed.kind === 'view') {
          setView(parsed.payload);
          setError(undefined);
        } else setError(parsed.message);
      },
      onHostContext: (context) => context.theme && setHostTheme(context.theme),
    });
    const listener = (event: MessageEvent) => next.handle(event);
    window.addEventListener('message', listener);
    next.connect(APP_INFO).then(
      () => setBridge(next),
      (err: unknown) => setError(`Could not reach the host: ${err instanceof Error ? err.message : String(err)}`),
    );
    return () => {
      window.removeEventListener('message', listener);
      next.dispose();
    };
  }, []);

  const viewId = view?.viewId;
  const sourceId = view?.sourceId;

  const runQueries = useCallback<McpHost['runQueries']>(
    async (args) => {
      if (!bridge || !viewId || !sourceId) throw new Error('Not connected to the host.');
      return parseRunResult(await bridge.callTool('run_queries', { viewId, sourceId, ...args }));
    },
    [bridge, viewId, sourceId],
  );
  const reportSize = useCallback<McpHost['reportSize']>((size) => bridge?.reportSize(size), [bridge]);

  return useMemo(() => ({ view, error, hostTheme, runQueries, reportSize }), [view, error, hostTheme, runQueries, reportSize]);
}
