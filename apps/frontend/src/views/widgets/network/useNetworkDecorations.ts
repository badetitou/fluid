import { useMemo } from 'react';
import { useDecorations } from '../../plugin-api/decorations';
import type { DecorationIndex } from '../../plugin-api/decorationModel';
import type { WidgetTheme } from '../../plugin-api/widgetTheme';
import type { GraphDecor } from './networkGraph';
import { decorationOverrides, drawableDerivedEdges, toDecoratedGraph, type DecorationOverrides } from './networkDecorations';
import type { Network } from './networkModel';

export interface NetworkDecorations {
  index: DecorationIndex;
  overrides: DecorationOverrides;
  /** Derived edges and edge looks for the graph of the `visible` network. */
  decor: GraphDecor;
}

/** The decorations of the network (evaluated on all of it) and how they apply to the drawn part. */
export function useNetworkDecorations(network: Network, visible: Network, theme: WidgetTheme): NetworkDecorations {
  const graph = useMemo(() => toDecoratedGraph(network.nodes, network.edges, network.selfLoops), [network]);
  const index = useDecorations(graph);
  const overrides = useMemo(() => decorationOverrides(index, theme.status), [index, theme.status]);
  const decor = useMemo<GraphDecor>(
    () => ({
      derived: drawableDerivedEdges(
        index.derivedEdges,
        new Set(visible.nodes.map((n) => n.key)),
        new Set(visible.edges.map((e) => e.key)),
      ),
      edges: overrides.edges,
    }),
    [index, overrides, visible],
  );
  return { index, overrides, decor };
}
