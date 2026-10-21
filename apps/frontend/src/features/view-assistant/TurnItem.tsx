import { memo } from 'react';
import { Button, Flex, Space, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { AssistantTurn } from '../../store';
import { ChatBubble, Reasoning } from '../../shared/ui';
import { refinedFrom, summarizeSpec, versionLabel } from './model';
import styles from './ViewAssistant.module.css';

interface TurnItemProps {
  turn: AssistantTurn;
  /** Spec version produced by this turn; undefined when it failed. */
  version: number | undefined;
  /** Whether this turn's version is the one shown in the preview. */
  active: boolean;
  onShow: (version: number) => void;
}

/** One exchange of the conversation: the prompt and the resulting version (or error). */
export const TurnItem = memo(function TurnItem({ turn, version, active, onShow }: TurnItemProps) {
  const from = refinedFrom(turn, version);
  return (
    <Space orientation="vertical" size={6} className={styles.full}>
      <ChatBubble role="user">
        {from !== null && (
          <Typography.Text type="secondary" className={`${styles.tiny} ${styles.block}`}>
            ↳ from {versionLabel(from)}
          </Typography.Text>
        )}
        <Typography.Text className={styles.pre}>{turn.prompt}</Typography.Text>
      </ChatBubble>
      {turn.error ? (
        <ChatBubble role="assistant" tone="error">
          <Typography.Text type="danger" className={styles.error}>
            {turn.error}
          </Typography.Text>
        </ChatBubble>
      ) : (
        turn.spec &&
        version !== undefined && (
          <ChatBubble role="assistant" tone={active ? 'active' : 'default'}>
            <Space orientation="vertical" size={4} className={styles.full}>
              <Flex justify="space-between" align="center" gap={8}>
                <Space size={4}>
                  <Tag color={active ? 'blue' : undefined} className={styles.tag}>
                    v{version}
                  </Tag>
                  <Typography.Text strong>{turn.spec.title ?? 'Untitled view'}</Typography.Text>
                </Space>
                <Tooltip title={active ? 'Shown in the preview' : 'Show this version'}>
                  <Button
                    size="small"
                    type={active ? 'primary' : 'text'}
                    icon={<EyeOutlined />}
                    onClick={() => onShow(version)}
                  />
                </Tooltip>
              </Flex>
              <Typography.Text type="secondary" className={styles.small}>
                {summarizeSpec(turn.spec)}
              </Typography.Text>
              {turn.reasoning && <Reasoning steps={turn.reasoning} />}
              {turn.model && (
                <Typography.Text type="secondary" className={styles.tiny}>
                  {turn.model} · {new Date(turn.at).toLocaleTimeString()}
                </Typography.Text>
              )}
            </Space>
          </ChatBubble>
        )
      )}
    </Space>
  );
});
