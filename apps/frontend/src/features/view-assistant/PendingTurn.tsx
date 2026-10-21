import { useEffect, useRef } from 'react';
import { BorderBeam, Space, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { ChatBubble } from '../../shared/ui';
import { versionLabel, type LiveOutput } from './model';
import type { PendingPrompt } from './useAssistantSession';
import styles from './ViewAssistant.module.css';

/** The prompt being answered, with the model's live output while it streams. */
export function PendingTurn({ pending, live }: { pending: PendingPrompt; live: LiveOutput | null }) {
  const liveRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [live]);

  return (
    <Space orientation="vertical" size={6} className={styles.full}>
      <ChatBubble role="user">
        <Typography.Text className={styles.pre}>{pending.prompt}</Typography.Text>
      </ChatBubble>
      <ChatBubble role="assistant" wrap={(bubble) => <BorderBeam>{bubble}</BorderBeam>}>
        <Typography.Text type="secondary">
          <LoadingOutlined /> Working on{' '}
          {pending.basedOn !== null ? versionLabel(pending.basedOn) : 'a first version'}…
        </Typography.Text>
        {live && (
          <pre ref={liveRef} className={styles.live}>
            {live.thinking && (
              <span className={styles.thinking}>
                {live.thinking}
                {'\n\n'}
              </span>
            )}
            {live.text}
          </pre>
        )}
      </ChatBubble>
    </Space>
  );
}
