import { Input } from 'antd';
import { usePluginSettings, type FluidPlugin } from '../../entities/plugin';
import styles from './PluginManager.module.css';

/** The settings a plugin declares (e.g. a backend URL), saved as they are typed. */
export function PluginSettings({ plugin }: { plugin: FluidPlugin }) {
  const { values, set } = usePluginSettings(plugin);
  const declared = plugin.manifest.settings ?? [];
  if (declared.length === 0) return null;
  return (
    <div className={styles.settings}>
      {declared.map((setting) => (
        <label key={setting.key} className={styles.setting}>
          <span className={styles.settingLabel}>{setting.label}</span>
          <Input
            size="small"
            value={values[setting.key]}
            placeholder={setting.placeholder}
            onChange={(e) => set(setting.key, e.target.value)}
            aria-label={`${plugin.manifest.name}: ${setting.label}`}
          />
          {setting.description && <span className={styles.settingHelp}>{setting.description}</span>}
        </label>
      ))}
    </div>
  );
}
