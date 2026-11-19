import { useCallback } from 'react';
import type { ColumnRef } from '../../navigation/millerPath';
import { fluidLink, pickView } from './linkModel';
import { parseViewRows } from './toolResult';
import type { McpHost } from './useMcpHost';

/**
 * Follows a link between entities: in place when fluid has a saved view for it (`list_views`, then
 * `show_view` from the app), else in fluid in a new tab (`ui/open-link`).
 */
export function useEntityLinks(host: Pick<McpHost, 'bridge' | 'view' | 'showInPlace'>): (ref: ColumnRef) => Promise<void> {
  const { bridge, view, showInPlace } = host;
  return useCallback(
    async (ref) => {
      if (!bridge || !view) return;
      const rows = parseViewRows(await bridge.callTool('list_views', { concept: ref.concept }));
      const target = pickView(rows, ref);
      if (target) {
        const variables = ref.itemId === undefined ? undefined : { id: ref.itemId };
        showInPlace(await bridge.callTool('show_view', { viewId: target.id, sourceId: view.sourceId, ...(variables ? { variables } : {}) }));
      } else if (view.fluidUrl) {
        await bridge.openLink(fluidLink(view.fluidUrl, ref));
      } else throw new Error(`fluid has no saved view for ${ref.concept}.`);
    },
    [bridge, view, showInPlace],
  );
}
