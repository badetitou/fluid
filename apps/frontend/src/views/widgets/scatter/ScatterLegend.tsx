import type { ScatterLayout } from './scatterModel';
import styles from './Scatter.module.css';

/** The color of each category, when the dots are colored by a field. */
export function ScatterLegend({ categories }: { categories: ScatterLayout['categories'] }) {
  if (categories.length === 0) return null;
  return (
    <div className={styles.legend}>
      {categories.map((c) => (
        <span key={c.name}>
          <span className={styles.swatch} style={{ background: c.color }} />
          {c.name}
        </span>
      ))}
    </div>
  );
}
