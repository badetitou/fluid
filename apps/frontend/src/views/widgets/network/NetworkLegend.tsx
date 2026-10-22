import { groupColor } from './networkStyle';
import styles from './Network.module.css';

/** The color of each group of nodes, when they have one. */
export function NetworkLegend({ groups, series }: { groups: string[]; series: string[] }) {
  if (groups.length === 0) return null;
  return (
    <div className={styles.legend}>
      {groups.map((group) => (
        <span key={group}>
          <span className={styles.swatch} style={{ background: groupColor(groups, group, series) }} />
          {group}
        </span>
      ))}
    </div>
  );
}
