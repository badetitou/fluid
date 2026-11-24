import { Drawer, Spin } from 'antd';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { useConcept } from '../../../concept';
import type { PageActionPanelProps } from '../../pageAction';
import { ChatDrawer } from './ChatDrawer';

/** Introspects the column's concept (the chat prompts the model with its schema), then opens the drawer. */
export function ChatPanel({ context, onClose }: PageActionPanelProps) {
  const { concept } = useConcept(context.column.concept);
  const isMobile = useIsMobile();
  if (!concept)
    return (
      <Drawer open size={isMobile ? '100%' : 520} onClose={onClose} title="Chat">
        <Spin />
      </Drawer>
    );
  return <ChatDrawer concept={concept} column={context.column} onClose={onClose} />;
}
