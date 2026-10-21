import { Button, Input, Space, Tag, Typography } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import type { CodeView } from './useCodeView';
import styles from './Code.module.css';

interface CodeToolbarProps {
  view: CodeView;
  /** Name of the compared version, shown with the diff counts. */
  compareLabel?: string;
  searchable: boolean;
}

const SEVERITY_TAG = { error: 'error', warning: 'warning', info: 'processing' } as const;

/** Search box with hit stepping, diff counts, annotation counts and copy. */
export function CodeToolbar({ view, compareLabel, searchable }: CodeToolbarProps) {
  const { search, counts, stats } = view;
  const total = search.matches.length;
  return (
    <div className={styles.toolbar}>
      {searchable && (
        <Space.Compact size="small">
          <Input
            allowClear
            placeholder="Search"
            aria-label="Search the code"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onPressEnter={(e) => (e.shiftKey ? search.previous() : search.next())}
            className={styles.search}
          />
          <Button icon={<UpOutlined />} aria-label="Previous match" disabled={!total} onClick={search.previous} />
          <Button icon={<DownOutlined />} aria-label="Next match" disabled={!total} onClick={search.next} />
        </Space.Compact>
      )}
      {search.query && (
        <Typography.Text type="secondary" className={styles.count}>
          {total ? `${search.currentIndex + 1} / ${total}` : 'No match'}
        </Typography.Text>
      )}
      <span className={styles.spacer} />
      {view.isDiff && (
        <Typography.Text type="secondary" className={styles.count}>
          <span className={styles.added}>+{stats.added}</span> <span className={styles.removed}>−{stats.removed}</span>
          {` vs ${compareLabel ?? 'before'}`}
        </Typography.Text>
      )}
      {(['error', 'warning', 'info'] as const).map(
        (s) =>
          counts[s] > 0 && (
            <Tag key={s} color={SEVERITY_TAG[s]} variant="filled">
              {counts[s]} {s}
              {counts[s] > 1 ? 's' : ''}
            </Tag>
          ),
      )}
      <Typography.Text copyable={{ text: view.source }} />
    </div>
  );
}
