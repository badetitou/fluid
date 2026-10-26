import type { ThresholdPreset } from './pyramidDefinitions';
import styles from './Pyramid.module.css';

const ITEMS = [
  { className: styles.low, label: 'Low' },
  { className: styles.average, label: 'Average' },
  { className: styles.high, label: 'High' },
  { className: styles.size, label: 'Size & complexity' },
  { className: styles.coupling, label: 'Coupling' },
  { className: styles.inheritance, label: 'Inheritance' },
];

const PRESET_NAMES: Record<ThresholdPreset, string> = { java: 'Java', cpp: 'C++', smalltalk: 'Smalltalk' };

/** What the colors mean: the three levels of the ratios (against which thresholds) and the three parts. */
export function PyramidLegend({ preset, custom }: { preset: ThresholdPreset; custom: boolean }) {
  return (
    <div className={styles.legend} aria-label="Legend">
      {ITEMS.map((item) => (
        <span key={item.label} className={styles.legendItem}>
          <span className={`${styles.swatch} ${item.className}`} />
          {item.label}
        </span>
      ))}
      <span className={styles.legendItem}>
        Ratios against {PRESET_NAMES[preset]} thresholds{custom ? ' (adjusted)' : ''}
      </span>
    </div>
  );
}
