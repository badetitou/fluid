import { Alert, Space, Switch, Typography } from 'antd';
import { useBffSourceConfig, useSources } from '../../entities/source';
import { BffAuthForm } from './BffAuthForm';
import styles from './SourceSwitcher.module.css';

/** "Via the BFF" for the connected source: its requests go through the BFF, which can hold an API key. */
export function BffSourceSettings() {
  const { current, currentName } = useSources();
  const bff = useBffSourceConfig(current ?? '', currentName);
  const disabled = bff.available !== true || !current;

  return (
    <div>
      <Space>
        <Switch
          checked={bff.routed}
          disabled={disabled}
          loading={bff.busy || bff.available === null}
          onChange={(on) => void (on ? bff.enable() : bff.disable())}
          aria-label="Via the BFF"
        />
        <Typography.Text strong>Via the BFF</Typography.Text>
      </Space>
      <Typography.Paragraph type="secondary" className={styles.full}>
        {bff.available === false
          ? 'No BFF is reachable, so this source can only be queried directly from the browser.'
          : 'Send this source’s requests through the BFF, which can add an API key or token the browser never sees.'}
      </Typography.Paragraph>
      {bff.error && <Alert type="error" showIcon title={bff.error} />}
      {bff.routed && bff.config && (
        <BffAuthForm
          key={`${bff.config.id}:${bff.config.authKind}:${bff.config.headerName}:${bff.config.hasSecret}`}
          config={bff.config}
          busy={bff.busy}
          onSave={bff.save}
          onRemoveSecret={bff.removeSecret}
        />
      )}
    </div>
  );
}
