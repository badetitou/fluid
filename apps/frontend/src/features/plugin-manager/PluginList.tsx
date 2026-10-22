import { usePluginActions, usePlugins } from '../../entities/plugin';
import { PluginRow } from './PluginRow';
import styles from './PluginManager.module.css';

/** Every plugin, built-in first, each with its switch. */
export function PluginList() {
  const entries = usePlugins();
  const { setEnabled, uninstall } = usePluginActions();
  return (
    <div className={styles.list}>
      {entries.map(({ plugin, enabled }) => (
        <PluginRow
          key={plugin.manifest.id}
          plugin={plugin}
          enabled={enabled}
          onToggle={(on) => setEnabled(plugin.manifest.id, on)}
          onRemove={() => uninstall(plugin.manifest.id)}
        />
      ))}
    </div>
  );
}
