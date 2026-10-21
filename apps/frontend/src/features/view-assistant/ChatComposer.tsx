import { useState } from 'react';
import { Button, Input, Space, Typography } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { versionLabel } from './model';
import styles from './ViewAssistant.module.css';

interface ChatComposerProps {
  /** Whether a version exists to refine (changes the placeholder). */
  hasSpec: boolean;
  generating: boolean;
  /** Older version the next prompt refines, when it is not the latest. */
  refining: number | null;
  onBackToLatest: () => void;
  onSend: (prompt: string) => void;
  onStop: () => void;
}

/** Prompt box of the assistant: Enter sends, Shift+Enter breaks the line. */
export function ChatComposer({ hasSpec, generating, refining, onBackToLatest, onSend, onStop }: ChatComposerProps) {
  const [prompt, setPrompt] = useState('');

  const send = () => {
    if (!prompt.trim() || generating) return;
    onSend(prompt);
    setPrompt('');
  };

  return (
    <div className={styles.composer}>
      {refining !== null && (
        <Typography.Text type="secondary" className={styles.hint}>
          Next prompt refines {versionLabel(refining)}.{' '}
          <Typography.Link onClick={onBackToLatest}>Back to latest</Typography.Link>
        </Typography.Text>
      )}
      <Space.Compact className={styles.full}>
        <Input.TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            hasSpec
              ? 'Refine, e.g. "add a pie chart of balances by currency"'
              : 'Describe a view or ask a question, e.g. "Which customers spent the most across all their accounts?"'
          }
          autoSize={{ minRows: 2, maxRows: 6 }}
          onPressEnter={(e) => {
            if (e.shiftKey) return;
            e.preventDefault();
            send();
          }}
        />
        {generating ? (
          <Button danger icon={<StopOutlined />} onClick={onStop} className={styles.tallButton} />
        ) : (
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={send}
            disabled={!prompt.trim()}
            className={styles.tallButton}
          />
        )}
      </Space.Compact>
    </div>
  );
}
