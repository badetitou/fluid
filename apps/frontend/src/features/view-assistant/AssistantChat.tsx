import { useEffect, useRef } from 'react';
import { Button, Flex, Popconfirm, Space, Tag, Typography } from 'antd';
import { ClearOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useLlmSettings } from '../../store';
import { useEffectiveProvider } from '../../entities/llm';
import { ChatBubble } from '../../shared/ui';
import { ChatComposer } from './ChatComposer';
import { PendingTurn } from './PendingTurn';
import { TurnItem } from './TurnItem';
import type { AssistantSession } from './useAssistantSession';
import styles from './ViewAssistant.module.css';

interface AssistantChatProps {
  session: AssistantSession;
  /** The assistant's opening message. */
  intro: string;
  onSend: (prompt: string) => void;
}

/** Left pane of the assistant: provider, conversation and prompt box. */
export function AssistantChat({ session, intro, onSend }: AssistantChatProps) {
  const effective = useEffectiveProvider();
  const model = useLlmSettings((s) => s.model);
  const provider = model ? `${effective} · ${model}` : effective;
  const { turns, versions, activeVersion, latestVersion, pending, live } = session;
  const generating = pending !== null;
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, pending]);

  return (
    <div className={styles.chat}>
      <Flex align="center" justify="space-between" gap={8} className={styles.toolbar}>
        <Tag icon={<ThunderboltOutlined />} color="blue" className={styles.tag}>
          {provider}
        </Tag>
        <Popconfirm
          title="Start a new conversation?"
          description="The current exchanges and versions will be forgotten."
          onConfirm={session.clear}
          disabled={turns.length === 0 || generating}
        >
          <Button size="small" icon={<ClearOutlined />} disabled={turns.length === 0 || generating}>
            New conversation
          </Button>
        </Popconfirm>
      </Flex>

      <div className={styles.scroll}>
        <Space orientation="vertical" size={12} className={styles.full}>
          <ChatBubble role="assistant">
            <Typography.Text>{intro}</Typography.Text>
          </ChatBubble>
          {turns.map((t) => {
            const version = versions.get(t.id);
            return (
              <TurnItem
                key={t.id}
                turn={t}
                version={version}
                active={version !== undefined && version === activeVersion}
                onShow={session.select}
              />
            );
          })}
          {pending && <PendingTurn pending={pending} live={live} />}
          <div ref={endRef} />
        </Space>
      </div>

      <ChatComposer
        hasSpec={session.spec !== null}
        generating={generating}
        refining={activeVersion !== null && activeVersion !== latestVersion ? activeVersion : null}
        onBackToLatest={() => session.select(null)}
        onSend={onSend}
        onStop={session.stop}
      />
    </div>
  );
}
