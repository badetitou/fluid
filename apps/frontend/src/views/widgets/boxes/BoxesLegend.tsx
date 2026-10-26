import { humanize } from '../../fieldHeuristics';
import type { ColorScale } from './boxesModel';
import { categoryColor, type BoxesPalette } from './boxesStyle';
import styles from './Boxes.module.css';

const MAX_CATEGORIES = 12;

const fieldName = (field: string) => humanize(field.split('.').pop() ?? field);
const show = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** The color legend: min → max of a metric, or the categories and their colors. */
export function BoxesLegend({ scale, palette }: { scale: ColorScale; palette: BoxesPalette }) {
  if (scale.kind === 'none') return null;
  if (scale.kind === 'sequential') {
    return (
      <div className={styles.legend} aria-label="Color legend">
        <span className={styles.legendField}>{fieldName(scale.field)}</span>
        <span>{show(scale.min)}</span>
        <span className={styles.gradient} style={{ background: `linear-gradient(to right, ${palette.low}, ${palette.high})` }} />
        <span>{show(scale.max)}</span>
      </div>
    );
  }
  const shown = scale.categories.slice(0, MAX_CATEGORIES);
  const more = scale.categories.length - shown.length;
  return (
    <div className={styles.legend} aria-label="Color legend">
      <span className={styles.legendField}>{fieldName(scale.field)}</span>
      {shown.map((c) => (
        <span key={c} className={styles.category}>
          <span className={styles.swatch} style={{ background: categoryColor(palette, scale.categories, c) }} />
          {c}
        </span>
      ))}
      {more > 0 && <span className={styles.more}>+{more} more</span>}
    </div>
  );
}
