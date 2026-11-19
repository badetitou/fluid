import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { ThemeMode } from '../../shared/theme';
import { HostBridge } from './bridge';
import { draftOf, previewFromInput } from './draftModel';
import { parseRunResult, parseSaveResult, parseToolResult } from './toolResult';
import { viewerReducer, type ViewerState } from './viewerState';

export interface McpHost extends ViewerState {
  /** The host's light or dark context, once known. */
  hostTheme?: ThemeMode;
  /** Runs `run_queries` on the host for the shown view; rejects with the tool's error. */
  runQueries: (args: { take?: number; variables?: Record<string, unknown> }) => Promise<ReturnType<typeof parseRunResult>>;
  /** Saves the shown draft in fluid (`save_view`); rejects with the tool's error. */
  saveDraft: () => Promise<void>;
  /** Tells the host the content size; does nothing until the handshake is done. */
  reportSize: (size: { width: number; height: number }) => void;
}

const APP_INFO = { name: 'fluid-mcp-app-viewer', version: '1.0.0' };

/** Connects to the host frame (MCP Apps handshake) and exposes what it sends. */
export function useMcpHost(): McpHost {
  const [state, dispatch] = useReducer(viewerReducer, {});
  const [hostTheme, setHostTheme] = useState<ThemeMode>();
  // Set once `ui/notifications/initialized` is sent: nothing else is posted before.
  const [bridge, setBridge] = useState<HostBridge>();

  useEffect(() => {
    const next = new HostBridge(window.parent, {
      onToolResult: (params) => dispatch({ type: 'result', parsed: parseToolResult(params) }),
      onToolInput: (params) => {
        const preview = previewFromInput(params);
        if (preview) dispatch({ type: 'input', preview });
      },
      onHostContext: (context) => context.theme && setHostTheme(context.theme),
    });
    const listener = (event: MessageEvent) => next.handle(event);
    window.addEventListener('message', listener);
    next.connect(APP_INFO).then(
      () => setBridge(next),
      (err: unknown) => dispatch({ type: 'failed', message: `Could not reach the host: ${err instanceof Error ? err.message : String(err)}` }),
    );
    return () => {
      window.removeEventListener('message', listener);
      next.dispose();
    };
  }, []);

  const { view } = state;
  const viewId = view?.viewId;
  const sourceId = view?.sourceId;

  const runQueries = useCallback<McpHost['runQueries']>(
    async (args) => {
      if (!bridge || !sourceId) throw new Error('Not connected to the host.');
      if (!viewId) throw new Error('Save the view in fluid to load more rows.');
      return parseRunResult(await bridge.callTool('run_queries', { viewId, sourceId, ...args }));
    },
    [bridge, viewId, sourceId],
  );

  const saveDraft = useCallback<McpHost['saveDraft']>(async () => {
    if (!bridge || !view?.draft) throw new Error('There is no draft to save.');
    const { concept, request } = view.draft;
    const saved = parseSaveResult(await bridge.callTool('save_view', { sourceId: view.sourceId, concept, request, view: draftOf(view.spec) }));
    dispatch({ type: 'saved', ...saved });
  }, [bridge, view]);

  const reportSize = useCallback<McpHost['reportSize']>((size) => bridge?.reportSize(size), [bridge]);

  return useMemo(
    () => ({ ...state, hostTheme, runQueries, saveDraft, reportSize }),
    [state, hostTheme, runQueries, saveDraft, reportSize],
  );
}
