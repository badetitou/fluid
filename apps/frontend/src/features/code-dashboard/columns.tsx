import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ClassFact, DeadMethod, Hotspot } from './model';
import styles from './CodeDashboard.module.css';

const nameCell = (name: string, file: string | null) => (
  <>
    {name}
    {file && <span className={styles.file}>{file}</span>}
  </>
);

export const hotspotColumns: ColumnsType<Hotspot> = [
  { title: 'Class', render: (_, h) => nameCell(h.cls.name, h.cls.file) },
  { title: 'Why', render: (_, h) => h.reasons.map((r) => <Tag key={r}>{r}</Tag>) },
  { title: 'Score', width: 70, align: 'right', render: (_, h) => h.score.toFixed(1) },
];

export const bigClassColumns: ColumnsType<ClassFact> = [
  { title: 'Class', render: (_, c) => nameCell(c.name, c.file) },
  { title: 'Lines', dataIndex: 'lines', width: 80, align: 'right' },
  { title: 'Methods', dataIndex: 'methodCount', width: 90, align: 'right' },
];

export const longMethodColumns: ColumnsType<{ className: string; name: string; lines: number }> = [
  { title: 'Method', render: (_, m) => `${m.className}.${m.name}` },
  { title: 'Lines', dataIndex: 'lines', width: 80, align: 'right' },
];

export const deadMethodColumns: ColumnsType<DeadMethod> = [
  { title: 'Method', render: (_, m) => nameCell(`${m.className}.${m.name}`, m.file) },
  { title: 'Lines', dataIndex: 'lines', width: 80, align: 'right' },
];

export const deadClassColumns: ColumnsType<ClassFact> = [
  { title: 'Class', render: (_, c) => nameCell(c.name, c.file) },
  { title: 'Lines', dataIndex: 'lines', width: 80, align: 'right' },
];
