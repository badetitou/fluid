import { ClearOutlined } from '@ant-design/icons';
import { Button, Segmented } from 'antd';
import type { ChatScope } from '@fluid/shared';
import styles from './Chat.module.css';

interface ChatHeaderProps {
  scope: ChatScope;
  hasView: boolean;
  canReset: boolean;
  onScope: (scope: ChatScope) => void;
  onReset: () => void;
}

/** The drawer title: what the chat is about (the graph or this view) and a reset. */
export function ChatHeader({ scope, hasView, canReset, onScope, onReset }: ChatHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerRow}>
        <span className={styles.title}>Chat</span>
        <Button size="small" type="text" icon={<ClearOutlined />} disabled={!canReset} onClick={onReset}>
          Reset
        </Button>
      </div>
      <Segmented<ChatScope>
        size="small"
        value={scope}
        onChange={onScope}
        options={[
          { label: 'Graph', value: 'graph' },
          { label: 'This view', value: 'view', disabled: !hasView },
        ]}
      />
    </div>
  );
}
