import { useMemo } from 'react';
import type { NetworkWidget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { networkGraph } from './networkGraph';
import { missingLinksReason, type Network } from './networkModel';
import { networkPalette, nodeColors, nodeSizes } from './networkStyle';
import { NetworkCanvas } from './NetworkCanvas';
import { NetworkLegend } from './NetworkLegend';
import { NetworkToolbar } from './NetworkToolbar';
import { NetworkTooltip } from './NetworkTooltip';
import { useNetworkLayout } from './useNetworkLayout';
import { useNetworkView } from './useNetworkView';
import styles from './Network.module.css';

interface NetworkExplorerProps {
  widget: NetworkWidget;
  network: Network;
  emit: (port: string, value: unknown) => void;
  /** Height of the whole widget: toolbar, canvas and legend. */
  height: number;
}

const TOOLBAR_HEIGHT = 30;
const LEGEND_HEIGHT = 24;
const MIN_CANVAS_HEIGHT = 120;
const LAYERED_DEFERRED_HINT = 'Too many nodes for layers: focus on a node to see them.';

/** The drawn network with its toolbar, hover card and legend. */
export function NetworkExplorer({ widget, network, emit, height }: NetworkExplorerProps) {
  const theme = useWidgetTheme(widget.type);
  const palette = useMemo(() => networkPalette(theme), [theme]);
  const view = useNetworkView(widget, network, emit);
  const { visible } = view;
  const colors = useMemo(() => nodeColors(visible, palette), [visible, palette]);
  const sizes = useMemo(() => nodeSizes(visible, widget.sizeField), [visible, widget.sizeField]);
  const graph = useMemo(() => networkGraph(visible, sizes), [visible, sizes]);
  const { running, layeredDeferred } = useNetworkLayout(graph, {
    graphLayout: widget.graphLayout ?? 'force',
    direction: widget.direction ?? 'TB',
  });
  const [stage, stageWidth] = useElementWidth<HTMLDivElement>();
  const handlers = useMemo(() => ({ onEnter: view.hover, onLeave: view.leave, onClick: view.select }), [view.hover, view.leave, view.select]);

  const legend = network.groups.length > 0 ? LEGEND_HEIGHT : 0;
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, height - TOOLBAR_HEIGHT - legend);
  const columns = widget.tooltipFields ?? [];

  return (
    <div className={styles.frame}>
      <NetworkToolbar
        network={network}
        view={view}
        running={running}
        hint={missingLinksReason(network, widget) ?? (layeredDeferred ? LAYERED_DEFERRED_HINT : null)}
      />
      <div ref={stage} className={styles.stage}>
        <NetworkCanvas
          graph={graph}
          colors={colors}
          palette={palette}
          highlight={view.highlight}
          handlers={handlers}
          height={canvasHeight}
          label={widget.title}
        />
        {view.hovered && (
          <NetworkTooltip
            node={view.hovered.node}
            at={view.hovered.at}
            columns={columns}
            color={colors.get(view.hovered.node.key)}
            frameWidth={stageWidth}
          />
        )}
      </div>
      <NetworkLegend groups={network.groups} series={palette.series} />
    </div>
  );
}
