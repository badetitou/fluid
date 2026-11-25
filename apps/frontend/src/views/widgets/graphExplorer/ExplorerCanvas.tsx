import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useElementWidth } from '../../../hooks/useElementWidth';
import type { NetworkPalette } from '../network/networkStyle';
import { useNetworkAppearance } from '../network/useNetworkAppearance';
import { ExpandedNodeBox, type CardPlacement } from './ExpandedNodeBox';
import { ExplorerNodeCard } from './ExplorerNodeCard';
import { ExplorerToolbar } from './ExplorerToolbar';
import { explorerGraph } from './explorerGraph';
import { useExplorerNode } from './GraphExplorerNodeContext';
import { drawHierarchyBoxes, type BoxPalette } from './hierarchyCanvas';
import type { HierarchyGraph } from './hierarchyModel';
import { useExplorerSigma } from './useExplorerSigma';
import styles from './GraphExplorer.module.css';

interface ExplorerCanvasProps {
  hierarchy: HierarchyGraph;
  colors: ReadonlyMap<string, string>;
  palette: NetworkPalette;
  height: number;
}

interface Hovered {
  key: string;
  at: { x: number; y: number };
}

const TOOLBAR_HEIGHT = 44;

/** WebGL nodes and edges (sigma), 2D boxes, and at most a few DOM widget cards. */
export function ExplorerCanvas({ hierarchy, colors, palette, height }: ExplorerCanvasProps) {
  const explorer = useExplorerNode();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<Hovered | undefined>();
  const [placements, setPlacements] = useState<ReadonlyMap<string, CardPlacement>>(new Map());
  const boxes = useRef<HTMLCanvasElement | null>(null);
  const canvasHeight = Math.max(140, height - TOOLBAR_HEIGHT);
  const graph = useMemo(() => explorerGraph(hierarchy), [hierarchy]);
  const attachWrapper = useCallback((el: HTMLDivElement | null) => measure(el), [measure]);
  const attachHost = useCallback((el: HTMLDivElement | null) => setContainer(el), []);
  const handlers = useMemo(
    () => ({
      onEnter: (key: string, at: { x: number; y: number }) => setHovered({ key, at }),
      onLeave: () => setHovered(undefined),
      onClick: (key: string) => explorer.select(key),
    }),
    [explorer],
  );
  const { sigma, version } = useExplorerSigma({
    container,
    graph,
    bounds: hierarchy.bounds,
    width,
    height: canvasHeight,
    handlers,
    palette,
  });
  const boxPalette = useMemo<BoxPalette>(
    () => ({
      border: palette.edge,
      subtle: palette.edgeMuted,
      surface: palette.hoverBackground,
      ink: palette.label,
      muted: palette.nodeMuted,
      selection: palette.selection,
    }),
    [palette],
  );
  const highlight = useMemo(() => {
    const focus = hovered?.key ?? explorer.session.overrides?.selectedKey;
    const key = typeof focus === 'string' ? focus : undefined;
    const neighbours = new Set<string>();
    if (key) {
      for (const edge of hierarchy.edges) {
        if (edge.source === key) neighbours.add(edge.target);
        if (edge.target === key) neighbours.add(edge.source);
      }
    }
    return { hovered: hovered?.key, selected: key, neighbours };
  }, [hierarchy.edges, hovered?.key, explorer.session.overrides?.selectedKey]);

  useNetworkAppearance(sigma, colors, palette, highlight);

  useEffect(() => {
    if (!sigma || width === 0) return;
    const project = (x: number, y: number) => sigma.graphToViewport({ x, y });
    const scale = sigma.getGraphToViewportRatio();
    const next = new Map<string, CardPlacement>();
    for (const key of explorer.session.expanded) {
      const node = hierarchy.byKey.get(key);
      if (!node || node.kind !== 'leaf') continue;
      const at = project(node.x, node.y);
      next.set(key, { left: at.x, top: at.y, scale });
    }
    setPlacements(next);
    const canvas = boxes.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHierarchyBoxes(ctx, hierarchy, project, boxPalette, {
      hovered: hovered?.key,
      selected: typeof highlight.selected === 'string' ? highlight.selected : undefined,
      width,
      height: canvasHeight,
    });
  }, [sigma, version, width, canvasHeight, hierarchy, boxPalette, hovered?.key, highlight.selected, explorer.session.expanded]);

  const cardKey = hovered?.key ?? (typeof highlight.selected === 'string' ? highlight.selected : undefined);
  const cardNode = cardKey ? hierarchy.byKey.get(cardKey) : undefined;
  const cardAt =
    hovered?.at ??
    (cardNode && sigma ? sigma.graphToViewport({ x: cardNode.x + cardNode.width / 2, y: cardNode.y + 10 }) : undefined);

  return (
    <div className={styles.frame} style={{ height }}>
      <ExplorerToolbar />
      <div ref={attachWrapper} className={styles.canvasWrap}>
        <div ref={attachHost} className={styles.canvas} style={{ height: canvasHeight }} role="img" aria-label="Graph explorer" />
        <canvas ref={boxes} className={styles.boxLayer} aria-hidden="true" />
        <div className={styles.cardLayerRoot}>
          {hierarchy.nodes
            .filter((node) => node.kind === 'leaf' && placements.has(node.key))
            .map((node) => (
              <ExpandedNodeBox
                key={node.key}
                node={node}
                placement={placements.get(node.key)!}
                compact={placements.get(node.key)!.scale < 0.45}
              />
            ))}
        </div>
        {cardNode && cardAt && (
          <ExplorerNodeCard node={cardNode} at={cardAt} frameWidth={width} frameHeight={canvasHeight} />
        )}
      </div>
    </div>
  );
}
