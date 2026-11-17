import { ClearOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { Button, Segmented } from 'antd';
import type { ChatScope } from '@fluid/shared';
import styles from './Chat.module.css';

interface ChatHeaderProps {
  scope: ChatScope;
  hasView: boolean;
  canReset: boolean;
  /** A turn is in flight: scope and reset wait for its answer. */
  busy: boolean;
  onScope: (scope: ChatScope) => void;
  onReset: () => void;
  /** Further commands, next to Reset (the build-a-view button). */
  extra?: ReactNode;
}

/** The drawer title: what the chat is about (the graph or this view) and a reset. */
export function ChatHeader({ scope, hasView, canReset, busy, onScope, onReset, extra }: ChatHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerRow}>
        <span className={styles.title}>Chat</span>
        {extra}
        <Button size="small" type="text" icon={<ClearOutlined />} disabled={!canReset || busy} onClick={onReset}>
          Reset
        </Button>
      </div>
      <Segmented<ChatScope>
        size="small"
        value={scope}
        disabled={busy}
        onChange={onScope}
        options={[
          { label: 'Graph', value: 'graph' },
          { label: 'This view', value: 'view', disabled: !hasView },
        ]}
      />
    </div>
  );
}
