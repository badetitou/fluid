import { cellOpacity } from './matrixStyle';
import styles from './Matrix.module.css';

interface MatrixLegendProps {
  /** The heaviest dependency. */
  max: number;
  /** Shows the cycle color (DSM). */
  cycles: boolean;
}

const STEPS = 5;

/** The weight scale (faint to opaque, 1 to max) and, in a DSM, the cycle color. */
export function MatrixLegend({ max, cycles }: MatrixLegendProps) {
  const weights = max <= 1 ? [1] : Array.from({ length: STEPS }, (_, k) => 1 + ((max - 1) * k) / (STEPS - 1));
  return (
    <span className={styles.legend} aria-label="Legend">
      <span>{max <= 1 ? 'dependency' : '1'}</span>
      {weights.map((w) => (
        <span key={w} className={styles.swatch} style={{ opacity: cellOpacity(w, max) }} />
      ))}
      {max > 1 && <span>{max}</span>}
      {cycles && (
        <>
          <span className={`${styles.swatch} ${styles.cycleSwatch}`} />
          <span>cycle</span>
        </>
      )}
    </span>
  );
}
