import { useEffect } from 'react';
import { drawNodeHover } from './drawNodeHover';
import { edgeLook, nodeLook, type Highlight, type NetworkPalette } from './networkStyle';
import type { NetworkSigma } from './useSigma';

/**
 * Applies the theme and the highlight to the renderer through its settings and
 * reducers: switching theme, mode or hovered node only refreshes the drawing,
 * the graph (and its layout) is left as it is.
 */
export function useNetworkAppearance(
  sigma: NetworkSigma | null,
  colors: ReadonlyMap<string, string>,
  palette: NetworkPalette,
  highlight: Highlight,
): void {
  useEffect(() => {
    if (!sigma) return;
    sigma.setSettings({
      labelFont: palette.font,
      labelColor: { color: palette.label },
      defaultNodeColor: palette.node,
      defaultEdgeColor: palette.edge,
      defaultDrawNodeHover: drawNodeHover(palette),
      nodeReducer: (key, attrs) => ({
        ...attrs,
        ...nodeLook(key, { label: attrs.label, size: attrs.size, color: colors.get(key) ?? palette.node }, highlight, palette),
      }),
      edgeReducer: (key, attrs) => {
        const graph = sigma.getGraph();
        return { ...attrs, ...edgeLook(graph.source(key), graph.target(key), highlight, palette) };
      },
    });
  }, [sigma, colors, palette, highlight]);
}
