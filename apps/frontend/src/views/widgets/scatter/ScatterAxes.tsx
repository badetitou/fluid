import { formatTick, MARGIN, type ScatterLayout } from './scatterModel';
import styles from './Scatter.module.css';

interface ScatterAxesProps {
  layout: ScatterLayout;
  xTitle: string;
  yTitle: string;
}

/** Grid lines, tick labels and titles of both axes. */
export function ScatterAxes({ layout, xTitle, yTitle }: ScatterAxesProps) {
  const { plot, xAxis, yAxis } = layout;
  const midY = (plot.top + plot.bottom) / 2;
  return (
    <g aria-hidden>
      {yAxis.ticks.map((t) => {
        const y = yAxis.toPixel(t);
        return (
          <g key={`y${t}`}>
            <line className={styles.gridLine} x1={plot.left} x2={plot.right} y1={y} y2={y} />
            <text className={styles.tickLabel} x={plot.left - 6} y={y} textAnchor="end" dominantBaseline="middle">
              {formatTick(t)}
            </text>
          </g>
        );
      })}
      {xAxis.ticks.map((t) => {
        const x = xAxis.toPixel(t);
        return (
          <g key={`x${t}`}>
            <line className={styles.gridLine} x1={x} x2={x} y1={plot.top} y2={plot.bottom} />
            <text className={styles.tickLabel} x={x} y={plot.bottom + 14} textAnchor="middle">
              {formatTick(t)}
            </text>
          </g>
        );
      })}
      <line className={styles.axisLine} x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} />
      <line className={styles.axisLine} x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} />
      <text className={styles.axisTitle} x={(plot.left + plot.right) / 2} y={layout.height - 6} textAnchor="middle">
        {xTitle}
      </text>
      <text
        className={styles.axisTitle}
        transform={`translate(${MARGIN.left - 42}, ${midY}) rotate(-90)`}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {yTitle}
      </text>
    </g>
  );
}
