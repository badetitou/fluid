import { Drawer } from 'antd';
import type { Concept } from '../../../concept';
import type { PageActionColumn } from '../../pageAction';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { useChatSession } from './useChatSession';
import styles from './Chat.module.css';

interface ChatDrawerProps {
  concept: Concept;
  column: PageActionColumn;
  onClose: () => void;
}

/** The chat about the graph or the column's view, in a drawer on the right. */
export function ChatDrawer({ concept, column, onClose }: ChatDrawerProps) {
  const { view, itemId } = column;
  const session = useChatSession({ concept, view, itemId });
  return (
    <Drawer
      open
      size={520}
      onClose={onClose}
      destroyOnHidden
      title={
        <ChatHeader
          scope={session.scope}
          hasView={view !== undefined}
          canReset={session.turns.length > 0}
          onScope={session.setScope}
          onReset={session.reset}
        />
      }
    >
      <div className={styles.body}>
        <ChatMessageList turns={session.turns} pending={session.pending} error={session.error} onRetry={session.retry} />
        <ChatInput disabled={session.pending} onSend={session.send} />
      </div>
    </Drawer>
  );
}
