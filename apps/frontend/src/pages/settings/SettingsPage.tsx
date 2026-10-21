import { Divider, Space, Typography } from 'antd';
import { ConnectionCard } from './ConnectionCard';
import { InterfaceCard } from './InterfaceCard';
import { LlmCard } from './LlmCard';
import styles from './SettingsPage.module.css';

/** Application preferences: data source, interface and assistant. */
export function SettingsPage() {
  return (
    <div className={styles.page}>
      <Space orientation="vertical" size={24} className={styles.full}>
        <div>
          <Typography.Title level={2}>Settings</Typography.Title>
          <Typography.Text type="secondary">Manage application preferences and configuration</Typography.Text>
        </div>
        <Divider />
        <ConnectionCard />
        <InterfaceCard />
        <LlmCard />
      </Space>
    </div>
  );
}
