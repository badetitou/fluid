import { Button, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { InsightAnalysis } from '@fluid/shared';
import { InsightFindingCard } from './InsightFindingCard';
import styles from './Insight.module.css';

interface InsightReportProps {
  analysis: InsightAnalysis;
  onRefresh: () => void;
}

const RefreshButton = ({ onRefresh }: { onRefresh: () => void }) => (
  <Tooltip title="Analyse again">
    <Button size="small" type="text" icon={<ReloadOutlined />} onClick={onRefresh} aria-label="Analyse again" />
  </Tooltip>
);

/** The analysis: its takeaway, the findings, the questions to dig into next; or a hello when there is nothing to add. */
export function InsightReport({ analysis, onRefresh }: InsightReportProps) {
  if (analysis.verdict === 'nothing' || analysis.findings.length === 0) {
    return (
      <div className={styles.status}>
        <span className={styles.hello}>Hello :)</span>
        <RefreshButton onRefresh={onRefresh} />
      </div>
    );
  }
  return (
    <>
      <div className={styles.headline}>
        <span>{analysis.headline ?? 'What stands out'}</span>
        <RefreshButton onRefresh={onRefresh} />
      </div>
      <ul className={styles.findings}>
        {analysis.findings.map((f, i) => (
          <InsightFindingCard key={`${i}-${f.title}`} finding={f} />
        ))}
      </ul>
      {analysis.questions && analysis.questions.length > 0 && (
        <div>
          <span className={styles.questionsTitle}>Worth digging into</span>
          <ul className={styles.questions}>
            {analysis.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
