import { Button, Popconfirm, Switch, Tag, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { pluginKind, themesOf, type FluidPlugin } from '../../entities/plugin';
import { pluginContents } from './model';
import { PLUGIN_KIND_META } from './pluginKinds';
import { PluginSettings } from './PluginSettings';
import { ThemeSwatches } from './ThemeSwatches';
import styles from './PluginManager.module.css';

interface PluginCardProps {
  plugin: FluidPlugin;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

/** One plugin, marked with its kind's icon and colour: what it brings, where it comes from, its switch and settings. */
export function PluginCard({ plugin, enabled, onToggle, onRemove }: PluginCardProps) {
  const { manifest, source, load } = plugin;
  const meta = PLUGIN_KIND_META[pluginKind(manifest)];
  return (
    <div className={`${styles.card} ${meta.accent} ${enabled ? '' : styles.off}`}>
      <div className={styles.cardHead}>
        <span className={styles.kindIcon}>{meta.icon}</span>
        <div className={styles.main}>
          <div className={styles.title}>
            <Typography.Text strong>{manifest.name}</Typography.Text>
            <Typography.Text type="secondary">v{manifest.version}</Typography.Text>
            <Tag bordered={false}>{source.kind === 'builtin' ? 'built-in' : new URL(source.url).host}</Tag>
            {plugin.required && <Tag bordered={false}>required</Tag>}
            {load.status === 'loading' && <Tag color="processing">loading</Tag>}
            {load.status === 'error' && <Tag color="error">failed to load</Tag>}
          </div>
          {manifest.description && <div className={styles.description}>{manifest.description}</div>}
          {load.status === 'error' && <Typography.Text type="danger">{load.message}</Typography.Text>}
        </div>
        <div className={styles.actions}>
          {source.kind === 'url' && (
            <Popconfirm title={`Remove ${manifest.name}?`} onConfirm={onRemove} okText="Remove">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Remove ${manifest.name}`} />
            </Popconfirm>
          )}
          <Switch
            checked={enabled}
            disabled={plugin.required}
            onChange={onToggle}
            aria-label={`${enabled ? 'Disable' : 'Enable'} ${manifest.name}`}
          />
        </div>
      </div>
      <div className={styles.contents}>
        {themesOf(plugin).map((t) => (
          <ThemeSwatches key={t.id} theme={t} />
        ))}
        {pluginContents(plugin).map((label) => (
          <span key={label} className={styles.chip}>
            {label}
          </span>
        ))}
      </div>
      {enabled && <PluginSettings plugin={plugin} />}
    </div>
  );
}
