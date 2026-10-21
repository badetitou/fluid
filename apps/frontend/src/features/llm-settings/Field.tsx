import type { ReactNode } from 'react';
import { Typography } from 'antd';
import styles from './LlmSettings.module.css';

/** A labelled form control spanning the modal's width. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <Typography.Text strong>{label}</Typography.Text>
      {children}
    </div>
  );
}
