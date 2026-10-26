import { HEADER_HEIGHT, type LayerColumn } from './blueprintLayout';
import styles from './Blueprint.module.css';

interface BlueprintColumnsProps {
  columns: LayerColumn[];
  height: number;
}

const BAND_MARGIN = 4;

/** The background bands and titles of the five layers. */
export function BlueprintColumns({ columns, height }: BlueprintColumnsProps) {
  return (
    <g data-part="columns">
      {columns.map((c) => (
        <g key={`${c.id}@${c.x}`}>
          <rect
            className={styles.columnBand}
            x={c.x - BAND_MARGIN}
            y={0}
            width={c.width + BAND_MARGIN * 2}
            height={height}
            rx={4}
          />
          <text className={styles.columnTitle} x={c.x + c.width / 2} y={HEADER_HEIGHT / 2 + 4}>
            {c.title}
          </text>
        </g>
      ))}
    </g>
  );
}
