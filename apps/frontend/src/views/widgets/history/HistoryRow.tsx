import type { ReactNode } from 'react';
import { Tag } from 'antd';
import { HistoryAvatar } from './HistoryAvatar';
import { relativeTime, shortId, type HistoryNode } from './historyModel';
import styles from './History.module.css';

interface HistoryRowProps {
  node: HistoryNode;
  avatarSrc?: string;
  /** Extra values (the widget's `columns`), already rendered. */
  extra: ReactNode[];
  /** Opens the version, when it can be opened. */
  onOpen?: () => void;
  onActivate: (key: string | undefined) => void;
}

/** One version: its labels, text, author, id and date. */
export function HistoryRow({ node, avatarSrc, extra, onOpen, onActivate }: HistoryRowProps) {
  const className = onOpen ? `${styles.row} ${styles.linked}` : styles.row;
  return (
    <div
      className={className}
      role={onOpen ? 'link' : 'listitem'}
      aria-label={node.label}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && e.key === 'Enter') onOpen();
      }}
      onMouseEnter={() => onActivate(node.key)}
      onMouseLeave={() => onActivate(undefined)}
      onFocus={() => onActivate(node.key)}
      onBlur={() => onActivate(undefined)}
    >
      <span className={styles.message} title={node.label}>
        {node.refs.map((ref) => (
          <Tag key={ref} className={styles.ref}>
            {ref}
          </Tag>
        ))}
        {node.label}
      </span>
      {extra.map((value, i) => (
        <span key={i} className={styles.extra}>
          {value}
        </span>
      ))}
      {(node.author || avatarSrc) && (
        <span className={styles.author} title={node.author}>
          <HistoryAvatar name={node.author} src={avatarSrc} />
          <span className={styles.authorName}>{node.author}</span>
        </span>
      )}
      {!node.key.startsWith('#') && <code className={styles.id}>{shortId(node.key)}</code>}
      {node.time !== undefined && (
        <span className={styles.date} title={new Date(node.time).toLocaleString()}>
          {relativeTime(node.time)}
        </span>
      )}
    </div>
  );
}
