import { Alert, Progress, Typography } from 'antd';
import { ModelResolutionAlert } from '../model-completeness';
import { ArchitectureSection } from './ArchitectureSection';
import { RankedCard } from './RankedCard';
import { KpiRow } from './KpiRow';
import { SizeDistribution } from './SizeDistribution';
import { bigClassColumns, deadClassColumns, deadMethodColumns, hotspotColumns, longMethodColumns } from './columns';
import { THRESHOLDS } from './model';
import { useCodeDashboard } from './useCodeDashboard';
import styles from './CodeDashboard.module.css';

/** Code-analysis dashboard of a Model source: size, big classes, dead code, technical-debt hotspots. */
export function CodeDashboardPage() {
  const { dashboard: d, loading, error, progress, truncated } = useCodeDashboard();

  return (
    <div className={styles.page}>
      <Typography.Title level={3}>Code analysis dashboard</Typography.Title>
      <ModelResolutionAlert />
      {error && <Alert type="error" showIcon message="Could not read the code model" description={error} />}
      {loading && (
        <Progress
          percent={progress.total ? Math.round((progress.read / progress.total) * 100) : undefined}
          status="active"
          format={() => `${progress.read} classes`}
        />
      )}
      {truncated && <Alert type="info" showIcon message={`Only the first ${progress.read} classes were read.`} />}
      {d && (
        <>
          <KpiRow dashboard={d} />
          <ArchitectureSection />
          <RankedCard
            title="Technical debt hotspots"
            hint="size + long and unused methods + isolation"
            rows={d.hotspots}
            columns={hotspotColumns}
            rowKey={(h) => h.cls.key}
          />
          <div className={styles.two}>
            <RankedCard
              title="Big classes"
              hint={`≥ ${THRESHOLDS.bigClassLines} lines or ≥ ${THRESHOLDS.bigClassMethods} methods`}
              rows={d.bigClasses}
              columns={bigClassColumns}
              rowKey={(c) => c.key}
            />
            <SizeDistribution buckets={d.sizeBuckets} />
            <RankedCard
              title="Long methods"
              hint={`≥ ${THRESHOLDS.longMethodLines} lines`}
              rows={d.longMethods}
              columns={longMethodColumns}
              rowKey={(m) => `${m.className}.${m.name}.${m.lines}`}
            />
            <RankedCard
              title="Dead code: unused methods"
              hint="no incoming relation (candidates)"
              rows={d.deadMethods}
              columns={deadMethodColumns}
              rowKey={(m) => `${m.className}.${m.name}.${m.lines}`}
            />
            <RankedCard
              title="Dead code: unreferenced classes"
              hint="nothing points at them (candidates)"
              rows={d.deadClasses}
              columns={deadClassColumns}
              rowKey={(c) => c.key}
            />
          </div>
        </>
      )}
    </div>
  );
}
