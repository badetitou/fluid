import { KIND_LABELS } from './blueprintStyle';
import styles from './Blueprint.module.css';

interface BlueprintLegendProps {
  /** The kinds present in the blueprint: only those are listed. */
  kinds: ReadonlySet<string>;
  /** E.g. "12 methods, 3 attributes". */
  summary: string;
}

/** What the box colors mean, and how many methods and attributes there are. */
export function BlueprintLegend({ kinds, summary }: BlueprintLegendProps) {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {KIND_LABELS.filter(([kind]) => kinds.has(kind)).map(([kind, label]) => (
        <li key={kind} className={styles.legendItem} data-kind={kind}>
          <span className={styles.swatch} />
          {label}
        </li>
      ))}
      <li className={styles.legendItem}>— call</li>
      <li className={styles.legendItem}>┄ attribute access</li>
      <li className={styles.legendItem}>{summary}</li>
    </ul>
  );
}
