import { Tag } from 'antd';
import type { InsightFinding } from '@fluid/shared';
import styles from './Insight.module.css';

/** One finding of the analysis: its kind and severity, the claim, why it matters and the figures behind it. */
export function InsightFindingCard({ finding }: { finding: InsightFinding }) {
  return (
    <li className={`${styles.finding} ${styles[finding.severity]}`} aria-label={finding.title}>
      <span className={styles.kind}>
        {finding.kind} · {finding.severity}
      </span>
      <span className={styles.title}>{finding.title}</span>
      <p className={styles.detail}>{finding.detail}</p>
      {finding.evidence && finding.evidence.length > 0 && (
        <span className={styles.evidence}>
          {finding.evidence.map((e) => (
            <Tag key={e} bordered={false}>
              {e}
            </Tag>
          ))}
        </span>
      )}
    </li>
  );
}
