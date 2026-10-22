import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Sigma from 'sigma';
import type { NodeAttributes, NetworkGraph } from './networkGraph';
import type { Point } from './layoutModel';

export type NetworkSigma = Sigma<NodeAttributes>;

/** What the canvas reports: pointer over a node (with its position in the frame), out of it, click. */
export interface SigmaHandlers {
  onEnter: (key: string, at: Point) => void;
  onLeave: () => void;
  onClick: (key: string) => void;
}

/**
 * The sigma renderer of `graph`, in `container`: created once, given each new
 * graph, killed on unmount. Zoom and pan are sigma's own (node dragging, later,
 * hooks into the same `downNode` / `moveBody` events).
 */
export function useSigma(container: HTMLDivElement | null, graph: NetworkGraph, handlers: SigmaHandlers): NetworkSigma | null {
  const [sigma, setSigma] = useState<NetworkSigma | null>(null);
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const initialGraph = useRef(graph);

  useEffect(() => {
    if (!container) return;
    const renderer: NetworkSigma = new Sigma(initialGraph.current, container, {
      allowInvalidContainer: true,
      defaultEdgeType: 'arrow',
      renderEdgeLabels: false,
      zIndex: true,
      labelSize: 12,
      labelRenderedSizeThreshold: 6,
      minCameraRatio: 0.02,
      maxCameraRatio: 10,
    });
    renderer.on('enterNode', ({ node, event }) => latest.current.onEnter(node, { x: event.x, y: event.y }));
    renderer.on('leaveNode', () => latest.current.onLeave());
    renderer.on('clickNode', ({ node }) => latest.current.onClick(node));
    setSigma(renderer);
    return () => {
      renderer.kill();
      setSigma(null);
    };
  }, [container]);

  useEffect(() => {
    if (sigma && sigma.getGraph() !== graph) sigma.setGraph(graph);
  }, [sigma, graph]);

  return sigma;
}
