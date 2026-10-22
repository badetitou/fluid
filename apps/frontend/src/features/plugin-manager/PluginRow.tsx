import { Button, Popconfirm, Switch, Tag, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { FluidPlugin } from '../../entities/plugin';
import styles from './PluginManager.module.css';

interface PluginRowProps {
  plugin: FluidPlugin;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

const LOAD_TAGS = { loading: <Tag color="processing">loading</Tag>, ready: null } as const;

/** One plugin: what it contributes, where it comes from, and its switch. */
export function PluginRow({ plugin, enabled, onToggle, onRemove }: PluginRowProps) {
  const { manifest, source, load } = plugin;
  const kinds = kindsOf(plugin);
  const contents = [
    ...plugin.contracts.map((c) => c.type),
    ...plugin.themes.map((t) => `theme: ${t.label}`),
  ];
  return (
    <div className={styles.row}>
      <div className={styles.main}>
        <div className={styles.title}>
          <Typography.Text strong>{manifest.name}</Typography.Text>
          <Typography.Text type="secondary">v{manifest.version}</Typography.Text>
          {kinds.map((k) => (
            <Tag key={k} color={k === 'widgets' ? 'blue' : 'purple'}>
              {k}
            </Tag>
          ))}
          <Tag>{source.kind === 'builtin' ? 'built-in' : new URL(source.url).host}</Tag>
          {load.status === 'error' ? (
            <Tag color="error">failed to load</Tag>
          ) : (
            LOAD_TAGS[load.status]
          )}
        </div>
        {manifest.description && (
          <Typography.Text type="secondary">{manifest.description}</Typography.Text>
        )}
        {load.status === 'error' && (
          <Typography.Text type="danger"> {load.message}</Typography.Text>
        )}
        <div className={styles.types}>{contents.join(' · ')}</div>
      </div>
      <div className={styles.actions}>
        {source.kind === 'url' && (
          <Popconfirm title={`Remove ${manifest.name}?`} onConfirm={onRemove} okText="Remove">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={`Remove ${manifest.name}`}
            />
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
  );
}

function kindsOf(plugin: FluidPlugin): Array<'themes' | 'widgets'> {
  return [
    ...(plugin.themes.length ? (['themes'] as const) : []),
    ...(plugin.contracts.length ? (['widgets'] as const) : []),
  ];
}
