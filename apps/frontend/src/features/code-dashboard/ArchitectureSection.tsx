import { Alert, Card, Statistic } from 'antd';
import { RankedCard } from './RankedCard';
import { cycleColumns, hubColumns, isolatedColumns } from './columns';
import { useModelAnalysis } from './useModelAnalysis';
import styles from './CodeDashboard.module.css';

const tone = (n: number) => (n > 0 ? 'var(--ant-color-warning, #faad14)' : undefined);

/** Dependency cycles, most connected and isolated entities, from Model's own analysis of the whole model. */
export function ArchitectureSection() {
  const state = useModelAnalysis();
  if (state.status === 'loading') return null;
  if (state.status === 'unavailable') {
    return <Alert type="info" showIcon message="This Model server does not expose its analyses (cycles, most connected entities)." />;
  }
  const a = state.architecture;
  return (
    <>
      <div className={styles.grid}>
        <Card size="small">
          <Statistic title="Dependency cycles" value={a.cycleCount} suffix={<span className={styles.muted}>{a.cyclicEntities} entities</span>} styles={{ content: { color: tone(a.cycleCount) } }} />
        </Card>
        <Card size="small">
          <Statistic title="Isolated classes and methods" value={a.isolatedCount} styles={{ content: { color: tone(a.isolatedCount) } }} />
        </Card>
      </div>
      <div className={styles.two}>
        <RankedCard title="Dependency cycles" hint="calls and references, biggest first" rows={a.cycles} columns={cycleColumns} rowKey={(c) => c.members.join('>')} />
        <RankedCard title="Most connected" hint="fan-in + fan-out, project code" rows={a.hubs} columns={hubColumns} rowKey={(e) => e.key} />
        <RankedCard title="Isolated classes and methods" hint="no call or reference in or out" rows={a.isolated} columns={isolatedColumns} rowKey={(e) => e.key} />
      </div>
    </>
  );
}
