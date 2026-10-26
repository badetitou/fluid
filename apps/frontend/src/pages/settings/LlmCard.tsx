import { lazy, Suspense, useState } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import styles from './SettingsPage.module.css';

const LlmSettingsModal = lazy(() =>
  import('../../features/llm-settings').then((m) => ({ default: m.LlmSettingsModal })),
);

/** Opens the LLM provider settings. */
export function LlmCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Space orientation="vertical" className={styles.full}>
        <Typography.Text type="secondary">
          Configure the LLM provider and settings used for generating views and suggestions.
        </Typography.Text>
        <div>
          <Button icon={<SettingOutlined />} onClick={() => setOpen(true)} type="primary">
            Configure LLM
          </Button>
        </div>
      </Space>
      {open && (
        <Suspense fallback={null}>
          <LlmSettingsModal onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </Card>
  );
}
