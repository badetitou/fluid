import type { ReactNode } from 'react';
import { ApiOutlined, PlusCircleOutlined, RobotOutlined, SkinOutlined } from '@ant-design/icons';
import { PLUGIN_KIND_META, usePluginCounts } from '../../features/plugin-manager';
import { sectionGroups, type SettingsSection, type SettingsSectionId } from './sections';
import styles from './SettingsPage.module.css';

const ICONS: Partial<Record<SettingsSectionId, ReactNode>> = {
  connection: <ApiOutlined />,
  interface: <SkinOutlined />,
  'add-plugin': <PlusCircleOutlined />,
  assistant: <RobotOutlined />,
};

interface SettingsNavProps {
  active: SettingsSectionId;
  onOpen: (id: SettingsSectionId) => void;
}

/** The settings menu: sections by group, plugin kinds with their icon, colour and how many are on. */
export function SettingsNav({ active, onOpen }: SettingsNavProps) {
  const counts = usePluginCounts();
  const iconOf = (s: SettingsSection) => ('kind' in s ? PLUGIN_KIND_META[s.kind].icon : ICONS[s.id]);
  return (
    <nav className={styles.nav} aria-label="Settings sections">
      {sectionGroups().map(({ group, sections }) => (
        <div key={group} className={styles.navGroup}>
          <div className={styles.navGroupTitle}>{group}</div>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === active ? 'page' : undefined}
              className={`${styles.navItem} ${'kind' in s ? PLUGIN_KIND_META[s.kind].accent : ''} ${s.id === active ? styles.navActive : ''}`}
              onClick={() => onOpen(s.id)}
            >
              <span className={styles.navIcon}>{iconOf(s)}</span>
              <span className={styles.navLabel}>{s.label}</span>
              {'kind' in s && (
                <span className={styles.navCount} title="enabled / installed">
                  {counts[s.kind].enabled}/{counts[s.kind].total}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
