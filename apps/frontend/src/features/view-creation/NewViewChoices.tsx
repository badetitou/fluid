import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';
import { CodeOutlined, DragOutlined, RobotOutlined } from '@ant-design/icons';
import styles from './NewViewChoices.module.css';

interface NewViewChoicesProps {
  onAssistant: () => void;
  onManual: () => void;
  onJson: () => void;
}

interface Choice {
  key: string;
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}

/** The blank page of a view being created: pick the editor to build it with. */
export function NewViewChoices({ onAssistant, onManual, onJson }: NewViewChoicesProps) {
  const choices: Choice[] = [
    { key: 'ai', icon: <RobotOutlined />, label: 'AI', hint: 'Describe the view, the assistant builds it', onClick: onAssistant },
    { key: 'manual', icon: <DragOutlined />, label: 'Manual editor', hint: 'Arrange the widgets with the mouse', onClick: onManual },
    { key: 'json', icon: <CodeOutlined />, label: 'JSON editor', hint: 'Write the view spec by hand', onClick: onJson },
  ];
  return (
    <Flex vertical align="center" justify="center" gap={20} className={styles.page}>
      <Typography.Text type="secondary">How do you want to build this view?</Typography.Text>
      <Flex wrap justify="center" gap={12}>
        {choices.map((c) => (
          <button key={c.key} type="button" className={styles.choice} onClick={c.onClick}>
            <span className={styles.icon}>{c.icon}</span>
            <span className={styles.label}>{c.label}</span>
            <span className={styles.hint}>{c.hint}</span>
          </button>
        ))}
      </Flex>
    </Flex>
  );
}
