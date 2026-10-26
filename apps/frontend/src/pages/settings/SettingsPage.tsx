import { Typography } from 'antd';
import { PLUGIN_KIND_META } from '../../features/plugin-manager';
import { SettingsNav } from './SettingsNav';
import { SettingsSectionView } from './SettingsSectionView';
import { useSettingsSection } from './useSettingsSection';
import styles from './SettingsPage.module.css';

/** Application preferences by category: source, interface, plugins (by kind) and assistant. */
export function SettingsPage() {
  const { section, open } = useSettingsSection();
  const meta = 'kind' in section ? PLUGIN_KIND_META[section.kind] : undefined;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Typography.Title level={2}>Settings</Typography.Title>
      </header>
      <div className={styles.layout}>
        <SettingsNav active={section.id} onOpen={open} />
        <main className={`${styles.content} ${meta?.accent ?? ''}`}>
          <div className={styles.sectionTitle}>
            {meta && <span className={styles.sectionIcon}>{meta.icon}</span>}
            <Typography.Title level={4}>{section.label}</Typography.Title>
          </div>
          <SettingsSectionView section={section} />
        </main>
      </div>
    </div>
  );
}
