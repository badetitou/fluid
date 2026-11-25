import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Sigma from 'sigma';
import { drawNodeHover } from '../network/drawNodeHover';
import type { NodeAttributes } from '../network/networkGraph';
import type { NetworkPalette } from '../network/networkStyle';
import { fittedRatio, normalizedCenter } from './cameraModel';
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

interface FitRequest {
  bounds: Bounds;
  width: number;
  height: number;
}

/** Sigma only reports its pixels-per-unit scale after a render: fit on the next frame. */
function fitCamera(renderer: ExplorerSigma, { bounds, width, height }: FitRequest): void {
  const current = renderer.getGraphToViewportRatio();
  const camera = renderer.getCamera();
  const ratio = fittedRatio(camera.getState().ratio, current, bounds, width, height);
  if (ratio === camera.getState().ratio) return;
  camera.setState({ ratio });
  renderer.refresh();
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
  const fitRequest = useRef<FitRequest | null>(null);

  useEffect(() => {
    if (!container) return;
    const renderer: ExplorerSigma = new Sigma(initialGraph.current, container, {
      allowInvalidContainer: true,
      defaultEdgeType: 'arrow',
      renderEdgeLabels: false,
      zIndex: true,
      labelSize: 12,
      labelRenderedSizeThreshold: 6,
      // Packed hierarchies span thousands of graph units: let the camera zoom
      // out far enough to show every box at once.
      minCameraRatio: 0.001,
      maxCameraRatio: 1000,
      defaultDrawNodeHover: drawNodeHover(initialPalette.current),
    });
    renderer.on('enterNode', ({ node, event }) => latest.current.onEnter(node, { x: event.x, y: event.y }));
    renderer.on('leaveNode', () => latest.current.onLeave());
    renderer.on('clickNode', ({ node }) => latest.current.onClick(node));
    renderer.on('afterRender', () => {
      setVersion((n) => n + 1);
      const request = fitRequest.current;
      if (!request) return;
      fitRequest.current = null;
      fitCamera(renderer, request);
    });
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
    const center = normalizedCenter(sigma.getBBox(), bounds);
    const camera = sigma.getCamera();
    camera.setState({ x: center.x, y: center.y, angle: 0, ratio: 1 });
    fitRequest.current = { bounds, width, height };
    sigma.refresh();
  }, [sigma, bounds, width, height]);

  return { sigma, version };
}
