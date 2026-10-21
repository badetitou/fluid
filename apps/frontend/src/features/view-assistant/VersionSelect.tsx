import { Select } from 'antd';
import { versionLabel } from './model';
import styles from './ViewAssistant.module.css';

interface VersionSelectProps {
  versions: number[];
  value: number;
  latest: number | null;
  onChange: (version: number) => void;
}

/** Picks the version shown in the preview, newest first. */
export function VersionSelect({ versions, value, latest, onChange }: VersionSelectProps) {
  const options = [...versions]
    .sort((a, b) => b - a)
    .map((v) => ({ value: v, label: `${versionLabel(v)}${v === latest && v !== 0 ? ' (latest)' : ''}` }));
  return (
    <Select size="small" value={value} onChange={onChange} className={styles.versionSelect} options={options} />
  );
}
