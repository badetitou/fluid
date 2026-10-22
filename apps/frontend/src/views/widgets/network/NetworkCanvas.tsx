import { useCallback, useEffect, useState } from 'react';
import { useElementWidth } from '../../../hooks/useElementWidth';
import type { NetworkGraph } from './networkGraph';
import type { Highlight, NetworkPalette } from './networkStyle';
import { useNetworkAppearance } from './useNetworkAppearance';
import { useSigma, type SigmaHandlers } from './useSigma';
import styles from './Network.module.css';

interface NetworkCanvasProps {
  graph: NetworkGraph;
  colors: ReadonlyMap<string, string>;
  palette: NetworkPalette;
  highlight: Highlight;
  handlers: SigmaHandlers;
  height: number;
  label?: string;
}

/**
 * The WebGL drawing of the graph (sigma). Its width follows the container (Miller
 * columns open and close): sigma only listens to window resizes on its own.
 */
export function NetworkCanvas({ graph, colors, palette, highlight, handlers, height, label }: NetworkCanvasProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setContainer(el);
      measure(el);
    },
    [measure],
  );
  const sigma = useSigma(container, graph, handlers);
  useNetworkAppearance(sigma, colors, palette, highlight);

  useEffect(() => {
    if (!sigma || width === 0) return;
    sigma.resize();
    sigma.refresh();
  }, [sigma, width, height]);

  return <div ref={ref} className={styles.canvas} style={{ height }} role="img" aria-label={label ?? 'Network'} />;
}
