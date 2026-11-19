import { useCallback, useMemo, useState } from 'react';
import { Alert, Flex } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import type { ColumnRef } from '../../navigation/millerPath';
import { ViewRenderer } from '../../views/ViewRenderer';
import { DraftBar } from './DraftBar';
import { LinkWatcher } from './LinkWatcher';
import { useDisplayMode } from './useDisplayMode';
import { useEntityLinks } from './useEntityLinks';
import type { McpHost } from './useMcpHost';
import { useSelectionContext } from './useSelectionContext';
import { createViewerClient } from './viewerClient';
import { ViewerToolbar } from './ViewerToolbar';

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The view the host sent, with what connects it to the conversation: selection, links, fullscreen. */
export function ShownView({ host }: { host: McpHost }) {
  const { view, savedTitle, history, bridge, hostContext, runQueries, saveDraft, back } = host;
  const client = useMemo(() => (view ? createViewerClient(view, runQueries) : null), [view, runQueries]);
  const selection = useSelectionContext(bridge, view?.spec);
  const follow = useEntityLinks(host);
  const display = useDisplayMode(bridge, hostContext);
  const [failure, setFailure] = useState<string>();
  const attempt = useCallback((run: () => Promise<void>) => {
    setFailure(undefined);
    run().catch((err: unknown) => setFailure(messageOf(err)));
  }, []);
  const onLink = useCallback((ref: ColumnRef) => attempt(() => follow(ref)), [attempt, follow]);

  if (!view || !client) return null;
  return (
    <Flex vertical gap={8}>
      <ViewerToolbar
        canGoBack={(history?.length ?? 0) > 0}
        onBack={back}
        onAsk={selection.selections.length > 0 ? () => attempt(selection.ask) : undefined}
        fullscreen={display.fullscreen}
        onToggleFullscreen={display.canFullscreen ? () => attempt(display.toggle) : undefined}
      />
      {failure && <Alert type="error" showIcon closable title={failure} onClose={() => setFailure(undefined)} />}
      <DraftBar draft={view.draft} savedTitle={savedTitle} onSave={saveDraft} />
      <UrqlProvider value={client}>
        {/* Widgets link to other items with router hooks: the watcher turns those into host requests. */}
        <MemoryRouter>
          <LinkWatcher onLink={onLink} />
          <ViewRenderer spec={view.spec} maxColumns={display.fullscreen ? 3 : 2} outputs={selection.outputs} />
        </MemoryRouter>
      </UrqlProvider>
    </Flex>
  );
}
