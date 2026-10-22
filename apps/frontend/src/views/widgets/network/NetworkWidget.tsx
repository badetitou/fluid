import { useMemo } from 'react';
import type { NetworkWidget as NetworkWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { buildNetwork, emptyReason } from './networkModel';
import { NetworkEmpty } from './NetworkEmpty';
import { NetworkExplorer } from './NetworkExplorer';

const DEFAULT_HEIGHT = 480;

/**
 * Items linked to each other, drawn with WebGL (sigma): thousands of nodes,
 * zoom and pan, hover card and neighbours, click to select (emitted on
 * `selected`, opened in a new column), focus on the selection's neighbourhood.
 *
 * Colors come from the theme (series by group); a theme may set, under
 * `widgets.network`: `edgeColor`, `mutedEdgeColor`, `activeEdgeColor`,
 * `mutedColor`, `externalColor`, `selectionColor`.
 */
export function NetworkWidget({ widget, data, resolve, emit, fitHeight }: WidgetProps<NetworkWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const edgesData = useMemo(() => (widget.edges ? resolve(widget.edges) : undefined), [resolve, widget.edges]);
  const network = useMemo(() => buildNetwork(data, edgesData, widget), [data, edgesData, widget]);
  const reason = emptyReason(data, network, widget.idField);
  if (reason) return <NetworkEmpty height={height} reason={reason} />;
  return <NetworkExplorer widget={widget} network={network} emit={emit} height={height} />;
}
