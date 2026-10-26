import { useState } from 'react';
import { Empty, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { usePluginActions, type PluginKind } from '../../entities/plugin';
import { PluginCard } from './PluginCard';
import { PLUGIN_KIND_META } from './pluginKinds';
import { usePluginsOfKind } from './usePluginsOfKind';
import styles from './PluginManager.module.css';

/** Every plugin of one kind, as cards, with a filter. */
export function PluginKindSection({ kind }: { kind: PluginKind }) {
  const [filter, setFilter] = useState('');
  const entries = usePluginsOfKind(kind, filter);
  const { setEnabled, uninstall } = usePluginActions();
  const meta = PLUGIN_KIND_META[kind];
  return (
    <section className={`${styles.section} ${meta.accent}`}>
      <p className={styles.help}>{meta.help}</p>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder={`Filter ${meta.title.toLowerCase()}`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label={`Filter ${meta.title.toLowerCase()}`}
        className={styles.filter}
      />
      {entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No plugin matches" />
      ) : (
        <div className={styles.grid}>
          {entries.map(({ plugin, enabled }) => (
            <PluginCard
              key={plugin.manifest.id}
              plugin={plugin}
              enabled={enabled}
              onToggle={(on) => setEnabled(plugin.manifest.id, on)}
              onRemove={() => uninstall(plugin.manifest.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
