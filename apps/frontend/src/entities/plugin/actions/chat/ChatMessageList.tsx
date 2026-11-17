import { useEffect, useRef } from 'react';
import { Alert, Button, Spin } from 'antd';
import type { ChatTurn } from '../../../llm';
import { ChatTurnItem } from './ChatTurnItem';
import styles from './Chat.module.css';

interface ChatMessageListProps {
  turns: ChatTurn[];
  pending: boolean;
  error: string | null;
  onRetry: () => void;
}

/** The scrollable conversation, kept scrolled to the latest entry; a failed turn shows its error and a retry. */
export function ChatMessageList({ turns, pending, error, onRetry }: ChatMessageListProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [turns, pending, error]);
  return (
    <div className={styles.list} role="log" aria-live="polite">
      {turns.length === 0 && (
        <div className={styles.empty}>Ask about the data, its structure, or what this view shows.</div>
      )}
      {turns.map((turn) => (
        <ChatTurnItem key={turn.id} turn={turn} />
      ))}
      {pending && <Spin size="small" aria-label="Thinking" />}
      {error && !pending && (
        <Alert
          type="error"
          showIcon
          title="The answer failed"
          description={error}
          action={
            <Button size="small" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      )}
      <div ref={end} />
    </div>
  );
}
