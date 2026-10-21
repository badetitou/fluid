import { PALETTE } from '../scatter/scatterModel';
import type { HistoryGraph, Segment } from './historyGraph';
import styles from './History.module.css';

interface HistoryLanesProps {
  graph: HistoryGraph;
  rowHeight: number;
  activeKey?: string;
}

/** Horizontal room taken by one lane, in px. */
export const LANE_WIDTH = 14;
const PADDING = 6;
const DOT_RADIUS = 4;

export const lanesWidth = (laneCount: number) => PADDING * 2 + laneCount * LANE_WIDTH;

const laneX = (lane: number) => PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
const colorOf = (index: number) => PALETTE[index % PALETTE.length];

// A straight line within a lane, or a curve when it moves to another lane.
function pathOf(s: Segment, top: number, rowHeight: number): string {
  const [x1, y1] = [laneX(s.fromLane), top + s.fromY * rowHeight];
  const [x2, y2] = [laneX(s.toLane), top + s.toY * rowHeight];
  if (x1 === x2) return `M${x1} ${y1}V${y2}`;
  const mid = (y1 + y2) / 2;
  return `M${x1} ${y1}C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
}

/** The graph drawn beside the lines: lanes, branch and merge curves, one dot per version. */
export function HistoryLanes({ graph, rowHeight, activeKey }: HistoryLanesProps) {
  const height = graph.rows.length * rowHeight;
  return (
    <svg className={styles.lanes} width={lanesWidth(graph.laneCount)} height={height} aria-hidden>
      {graph.rows.map((row, i) =>
        row.segments.map((s, j) => (
          <path key={`${i}-${j}`} className={styles.segment} d={pathOf(s, i * rowHeight, rowHeight)} stroke={colorOf(s.color)} />
        )),
      )}
      {graph.rows.map((row, i) => (
        <circle
          key={row.node.key}
          className={row.node.key === activeKey ? `${styles.dot} ${styles.activeDot}` : styles.dot}
          cx={laneX(row.lane)}
          cy={i * rowHeight + rowHeight / 2}
          r={row.node.parents.length > 1 ? DOT_RADIUS - 1 : DOT_RADIUS}
          fill={colorOf(row.color)}
        />
      ))}
    </svg>
  );
}
