import { Card, Statistic } from 'antd';
import type { Dashboard } from './model';
import styles from './CodeDashboard.module.css';

const fmt = (n: number) => n.toLocaleString('en');

/** The headline numbers: size of the project and how much of it is flagged. */
export function KpiRow({ dashboard: d }: { dashboard: Dashboard }) {
  const tone = (n: number) => (n > 0 ? 'var(--ant-color-warning, #faad14)' : undefined);
  return (
    <div className={styles.grid}>
      <Card size="small">
        <Statistic title="Classes" value={fmt(d.classCount)} suffix={<span className={styles.muted}>{fmt(d.methodCount)} methods</span>} />
      </Card>
      <Card size="small">
        <Statistic title="Lines in classes" value={fmt(d.totalLines)} />
      </Card>
      <Card size="small">
        <Statistic title="Big classes" value={d.bigClasses.length} styles={{ content: { color: tone(d.bigClasses.length) } }} />
      </Card>
      <Card size="small">
        <Statistic title="Unused methods" value={d.deadMethods.length} styles={{ content: { color: tone(d.deadMethods.length) } }} />
      </Card>
      <Card size="small">
        <Statistic title="Unreferenced classes" value={d.deadClasses.length} styles={{ content: { color: tone(d.deadClasses.length) } }} />
      </Card>
      <Card size="small">
        <Statistic title="Classes with no flag" value={d.healthyPercent} suffix="%" />
      </Card>
    </div>
  );
}
