import { Card, Progress } from 'antd';
import type { Dashboard } from './model';
import styles from './CodeDashboard.module.css';

/** How many classes fall in each size bucket (lines). */
export function SizeDistribution({ buckets }: { buckets: Dashboard['sizeBuckets'] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Card size="small" title="Class size (lines)">
      {buckets.map((b) => (
        <div key={b.label} className={styles.bucket}>
          <span>{b.label}</span>
          <Progress percent={(b.count / max) * 100} showInfo={false} size="small" />
          <span>{b.count}</span>
        </div>
      ))}
    </Card>
  );
}
