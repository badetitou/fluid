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
  /** Builds a view from the conversation, when it can be. */
  onBuildView?: () => void;
}

/** The scrollable conversation, kept scrolled to the latest entry; a failed turn shows its error and a retry. */
export function ChatMessageList({ turns, pending, error, onRetry, onBuildView }: ChatMessageListProps) {
  const list = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  // A new answer is read from its start (its widgets load after it is added, so its end moves);
  // the spinner and an error show at the bottom.
  useEffect(() => {
    const newest = list.current?.children[turns.length - 1];
    const isAnswer = turns[turns.length - 1]?.role === 'assistant';
    newest?.scrollIntoView?.({ block: isAnswer ? 'start' : 'end' });
  }, [turns]);
  useEffect(() => {
    if (pending || error) end.current?.scrollIntoView?.({ block: 'end' });
  }, [pending, error]);
  return (
    <div ref={list} className={styles.list} role="log" aria-live="polite">
      {turns.length === 0 && (
        <div className={styles.empty}>Ask about the data, its structure, or what this view shows.</div>
      )}
      {turns.map((turn) => (
        <ChatTurnItem key={turn.id} turn={turn} onBuildView={onBuildView} />
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
