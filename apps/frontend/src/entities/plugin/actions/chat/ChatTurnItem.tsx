import { Suspense } from 'react';
import { Skeleton } from 'antd';
import { LazyMarkdown } from '../../../../views/widgets/richtext/lazy';
import type { ChatTurn } from '../../../llm';
import { ChatAnswerView } from './ChatAnswerView';
import styles from './Chat.module.css';

/** One entry of the conversation: the user's words, a markdown answer (with its view), or a notice. */
export function ChatTurnItem({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'notice') return <div className={styles.notice}>{turn.text}</div>;
  if (turn.role === 'user') return <div className={styles.user}>{turn.text}</div>;
  return (
    <div className={styles.assistant}>
      <Suspense fallback={<Skeleton active paragraph={{ rows: 2 }} />}>
        <LazyMarkdown text={turn.text} />
      </Suspense>
      {turn.view && <ChatAnswerView view={turn.view} />}
      {turn.suggestView && <div className={styles.hint}>This conversation could become a view.</div>}
    </div>
  );
}
