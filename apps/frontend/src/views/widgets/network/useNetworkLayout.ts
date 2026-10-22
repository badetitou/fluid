import { useEffect, useState } from 'react';
import { inferSettings } from 'graphology-layout-forceatlas2';
import FA2LayoutSupervisor from 'graphology-layout-forceatlas2/worker';
import { effectiveLayout, forceDuration, layeredResponseSchema, type LayeredRequest, type LayeredResponse } from './layoutModel';
import type { NetworkGraph } from './networkGraph';

export interface LayoutOptions {
  graphLayout: 'force' | 'layered';
  direction: 'TB' | 'LR';
}

/** Runs ForceAtlas2 in its own worker for a while, moving the nodes as it goes. */
function runForce(graph: NetworkGraph, done: () => void): () => void {
  if (graph.order === 0) {
    done();
    return () => {};
  }
  const supervisor = new FA2LayoutSupervisor(graph, { settings: inferSettings(graph) });
  supervisor.start();
  const timer = setTimeout(() => {
    supervisor.stop();
    done();
  }, forceDuration(graph.order));
  return () => {
    clearTimeout(timer);
    supervisor.kill();
  };
}

/** Places the nodes in layers with dagre, in a web worker (on the main thread where there are none). */
function runLayered(graph: NetworkGraph, direction: LayoutOptions['direction'], done: () => void): () => void {
  const request: LayeredRequest = {
    nodes: graph.mapNodes((key, attrs) => ({ key, label: attrs.label })),
    edges: graph.mapEdges((_key, _attrs, source, target) => ({ source, target })),
    direction,
  };
  let cancelled = false;
  const apply = (message: unknown) => {
    const response = layeredResponseSchema.safeParse(message);
    if (cancelled || !response.success) return;
    graph.updateEachNodeAttributes((key, attrs) => ({ ...attrs, ...response.data.positions[key] }));
    done();
  };
  if (typeof Worker === 'undefined') {
    void import('./layeredLayout').then((m) => apply(m.layeredPositions(request)));
    return () => (cancelled = true);
  }
  const worker = new Worker(new URL('./layered.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<LayeredResponse>) => apply(event.data));
  // A failed worker leaves the nodes at their seeded places rather than "laying out" forever.
  worker.addEventListener('error', () => {
    if (!cancelled) done();
  });
  worker.postMessage(request);
  return () => {
    cancelled = true;
    worker.terminate();
  };
}

export interface LayoutState {
  /** The layout is being computed. */
  running: boolean;
  /** Layers were asked for but the graph is too big for them: forces are used instead. */
  layeredDeferred: boolean;
}

/** Lays the graph out off the main thread. */
export function useNetworkLayout(graph: NetworkGraph, { graphLayout, direction }: LayoutOptions): LayoutState {
  const [running, setRunning] = useState(true);
  const layout = effectiveLayout(graphLayout, graph.order, graph.size);
  useEffect(() => {
    setRunning(true);
    const done = () => setRunning(false);
    return layout === 'layered' ? runLayered(graph, direction, done) : runForce(graph, done);
  }, [graph, layout, direction]);
  return { running, layeredDeferred: layout !== graphLayout };
}
