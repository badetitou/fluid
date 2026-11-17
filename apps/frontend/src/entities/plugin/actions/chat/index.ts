import { MessageOutlined } from '@ant-design/icons';
import type { PageAction } from '../../pageAction';
import { LazyChatPanel } from './LazyChatPanel';

/** A classic chat with the LLM about the graph or the view of the column, on every column. */
export const chatAction: PageAction = {
  id: 'chat',
  label: 'Chat',
  description: 'Chat with the LLM about the graph or this view',
  Icon: MessageOutlined,
  Panel: LazyChatPanel,
};
