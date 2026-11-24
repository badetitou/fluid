import { useEffect, useMemo, useState } from 'react';
import type { GraphExplorerWidget } from '@fluid/shared';
import { networkGraph } from '../network/networkGraph';
import { useNetworkLayout } from '../network/useNetworkLayout';
import type { Point } from './graphExplorerFlow';
import type { ExplorerGraph } from './graphExplorerModel';

export interface ExplorerLayout {
  positions: ReadonlyMap<string, Point>;
  running: boolean;
  layeredDeferred: boolean;
}

function snapshot(graph: ReturnType<typeof networkGraph>): Map<string, Point> {
  const positions = new Map<string, Point>();
  graph.forEachNode((key, attrs) => positions.set(key, { x: attrs.x, y: attrs.y }));
  return positions;
}

/** Runs the existing force / layered layout, then hands its positions to React Flow. */
export function useExplorerLayout(explorer: ExplorerGraph, widget: GraphExplorerWidget): ExplorerLayout {
  const layoutGraph = useMemo(
    () => networkGraph(explorer.visible, new Map(explorer.visible.nodes.map((n) => [n.key, 6]))),
    [explorer.visible],
  );
  const { running, layeredDeferred } = useNetworkLayout(layoutGraph, {
    graphLayout: widget.graphLayout ?? 'force',
    direction: widget.direction ?? 'TB',
  });
  const [positions, setPositions] = useState<ReadonlyMap<string, Point>>(() => snapshot(layoutGraph));

  useEffect(() => {
    if (!running) setPositions(snapshot(layoutGraph));
  }, [running, layoutGraph]);

  return { positions, running, layeredDeferred };
}
