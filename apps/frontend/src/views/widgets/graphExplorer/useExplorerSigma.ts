import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Sigma from 'sigma';
import { drawNodeHover } from '../network/drawNodeHover';
import type { NodeAttributes } from '../network/networkGraph';
import type { NetworkPalette } from '../network/networkStyle';
import type { SigmaExplorerGraph } from './explorerGraph';
import type { Bounds } from './hierarchyModel';

export type ExplorerSigma = Sigma<NodeAttributes>;

export interface ExplorerSigmaHandlers {
  onEnter: (key: string, at: { x: number; y: number }) => void;
  onLeave: () => void;
  onClick: (key: string) => void;
}

interface ExplorerSigmaInput {
  container: HTMLDivElement | null;
  graph: SigmaExplorerGraph;
  bounds: Bounds;
  width: number;
  height: number;
  handlers: ExplorerSigmaHandlers;
  palette: NetworkPalette;
}

/** Sigma owns pan, zoom, hit testing and the WebGL drawing of thousands of nodes. */
export function useExplorerSigma({ container, graph, bounds, width, height, handlers, palette }: ExplorerSigmaInput): {
  sigma: ExplorerSigma | null;
  /** Bumped after every sigma render so the 2D box layer and DOM cards follow the camera. */
  version: number;
} {
  const [sigma, setSigma] = useState<ExplorerSigma | null>(null);
  const [version, setVersion] = useState(0);
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const initialGraph = useRef(graph);
  const initialPalette = useRef(palette);

  useEffect(() => {
    if (!container) return;
    const renderer: ExplorerSigma = new Sigma(initialGraph.current, container, {
      allowInvalidContainer: true,
      autoRescale: false,
      autoCenter: false,
      defaultEdgeType: 'arrow',
      renderEdgeLabels: false,
      zIndex: true,
      labelSize: 12,
      labelRenderedSizeThreshold: 6,
      // Packed hierarchies can span tens of thousands of graph units: let the
      // camera zoom far enough out to show every box at once.
      minCameraRatio: 0.001,
      maxCameraRatio: 1000,
      defaultDrawNodeHover: drawNodeHover(initialPalette.current),
    });
    renderer.on('enterNode', ({ node, event }) => latest.current.onEnter(node, { x: event.x, y: event.y }));
    renderer.on('leaveNode', () => latest.current.onLeave());
    renderer.on('clickNode', ({ node }) => latest.current.onClick(node));
    renderer.on('afterRender', () => setVersion((n) => n + 1));
    setSigma(renderer);
    return () => {
      renderer.kill();
      setSigma(null);
    };
  }, [container]);

  useEffect(() => {
    if (sigma && sigma.getGraph() !== graph) sigma.setGraph(graph);
  }, [sigma, graph]);

  useEffect(() => {
    if (!sigma) return;
    sigma.setSettings({
      labelFont: palette.font,
      labelColor: { color: palette.label },
      defaultEdgeColor: palette.edge,
      defaultDrawNodeHover: drawNodeHover(palette),
    });
  }, [sigma, palette]);

  useEffect(() => {
    if (!sigma || width === 0 || height === 0) return;
    sigma.resize();
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const desired = Math.min(width / spanX, height / spanY) * 0.88;
    const camera = sigma.getCamera();
    camera.setState({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, angle: 0, ratio: 1 });
    const scale = sigma.getGraphToViewportRatio();
    camera.setState({ ratio: Math.max(0.001, scale / Math.max(desired, 0.0001)) });
    sigma.refresh();
  }, [sigma, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, width, height]);

  return { sigma, version };
}
