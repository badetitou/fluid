import { useCallback, useMemo } from 'react';
import type { SankeyWidget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { assignColumns, backLinks, nodePriority } from './sankeyColumns';
import { layoutSankey, type PlacedLink, type PlacedNode } from './sankeyLayout';
import type { FlowGraph } from './sankeyModel';
import { SankeyLinks } from './SankeyLinks';
import { SankeyNodes } from './SankeyNodes';
import { SankeyTooltip } from './SankeyTooltip';
import { useSankeySelection } from './useSankeySelection';
import styles from './Sankey.module.css';

interface SankeyChartProps {
  widget: SankeyWidget;
  graph: FlowGraph;
  emit: (port: string, value: unknown) => void;
  height: number;
}

const NOTE_HEIGHT = 20;

/** The measured diagram: ribbons under nodes, a hover card, and a note when some links close cycles. */
export function SankeyChart({ widget, graph, emit, height }: SankeyChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const theme = useWidgetTheme('sankey');
  const backCount = useMemo(() => {
    const columnOf = assignColumns(graph, nodePriority(graph, widget.nodeOrder), widget.columns);
    return backLinks(graph, columnOf).length;
  }, [graph, widget.nodeOrder, widget.columns]);
  const plotHeight = height - (backCount > 0 ? NOTE_HEIGHT : 0);
  const layout = useMemo(
    () => layoutSankey(graph, { width: Math.floor(width), height: plotHeight, nodeOrder: widget.nodeOrder, columns: widget.columns }),
    [graph, width, plotHeight, widget.nodeOrder, widget.columns],
  );
  const selection = useSankeySelection(layout, emit);

  const series = theme.series;
  const nodeColor = useCallback((n: PlacedNode) => series[n.index % series.length], [series]);
  const sourceIndex = useMemo(() => new Map(layout.nodes.map((n) => [n.key, n.index])), [layout.nodes]);
  const linkColor = useCallback(
    (l: PlacedLink) => (l.back && theme.vars.cycleColor) || series[(sourceIndex.get(l.source) ?? 0) % series.length],
    [series, sourceIndex, theme.vars.cycleColor],
  );

  return (
    <div ref={ref} className={styles.frame}>
      {width > 0 && (
        <svg className={styles.svg} width={layout.width} height={layout.height} role="group" aria-label={widget.title ?? 'Flows'}>
          <SankeyLinks links={layout.links} selection={selection} colorOf={linkColor} />
          <SankeyNodes nodes={layout.nodes} selection={selection} colorOf={nodeColor} labelColor={theme.vars.labelColor ?? theme.ink} />
        </svg>
      )}
      {selection.hovered && <SankeyTooltip item={selection.hovered} layout={layout} />}
      {backCount > 0 && (
        <div className={styles.note}>
          {backCount === 1 ? '1 flow goes back' : `${backCount} flows go back`} (cycles): dashed, drawn below.
        </div>
      )}
    </div>
  );
}
