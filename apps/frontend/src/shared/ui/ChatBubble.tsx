import type { ReactNode } from 'react';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import styles from './ChatBubble.module.css';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  /** `active` highlights the bubble, `error` shows it as a failure. */
  tone?: 'default' | 'active' | 'error';
  /** Wraps the bubble itself, e.g. in an animated border while it is pending. */
  wrap?: (bubble: ReactNode) => ReactNode;
}

/** One message of a chat with the assistant, with the speaker's avatar. */
export function ChatBubble({ role, children, tone = 'default', wrap }: ChatBubbleProps) {
  const isUser = role === 'user';
  const toneClass = tone === 'default' ? '' : styles[tone];
  const bubble = <div className={`${styles.bubble} ${toneClass} ${wrap ? styles.grow : ''}`}>{children}</div>;
  return (
    <div className={`${styles.row} ${isUser ? styles.user : ''}`}>
      {!isUser && <RobotOutlined className={styles.assistantAvatar} />}
      {wrap ? wrap(bubble) : bubble}
      {isUser && <UserOutlined className={styles.avatar} />}
    </div>
  );
}
