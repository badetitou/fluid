import type { ReactNode } from 'react';
import styles from './Badge.module.css';

/** An outlined, non-interactive tag (badetitou Badge): the label carries the meaning. */
export function Badge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>;
}
