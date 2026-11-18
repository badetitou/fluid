import { Alert, Space, Switch, Typography } from 'antd';
import { authFormKey, useBffSourceConfig, useSources } from '../../entities/source';
import { BffAuthForm } from './BffAuthForm';
import { OAuthStatus } from './OAuthStatus';
import styles from './SourceSwitcher.module.css';

/** "Via the BFF" for the connected source: its requests go through the BFF, which can hold an API key. */
export function BffSourceSettings() {
  const { current, currentName, currentAuth } = useSources();
  const bff = useBffSourceConfig(current ?? '', currentName);
  // Only turning it on needs a BFF: a routed source can always go back to a direct connection.
  const disabled = !current || (!bff.routed && bff.available !== true);
  const unreachable = bff.available === false;
  let explanation = 'Send this source’s requests through the BFF, which can add an API key or token the browser never sees.';
  if (unreachable && bff.routed) {
    explanation =
      'The BFF is unreachable: requests to this source fail until it is back, or turn this off to query it directly.';
  } else if (unreachable) {
    explanation = 'No BFF is reachable, so this source can only be queried directly from the browser.';
  }

  return (
    <div>
      <Space>
        <Switch
          checked={bff.routed}
          disabled={disabled}
          loading={bff.busy || (bff.available === null && !bff.routed)}
          onChange={(on) => void (on ? bff.enable() : bff.disable())}
          aria-label="Via the BFF"
        />
        <Typography.Text strong>Via the BFF</Typography.Text>
      </Space>
      <Typography.Paragraph type="secondary" className={styles.full}>
        {explanation}
      </Typography.Paragraph>
      {bff.error && <Alert type="error" showIcon title={bff.error} />}
      {bff.routed && bff.config && (
        <BffAuthForm
          key={authFormKey(bff.config)}
          config={bff.config}
          busy={bff.busy}
          suggested={currentAuth}
          onSave={bff.save}
          onRemoveSecret={bff.removeSecret}
          onRemoveClientSecret={bff.removeClientSecret}
        />
      )}
      {bff.routed && bff.config && (
        <OAuthStatus config={bff.config} busy={bff.busy} onSignedIn={() => void bff.refresh()} onSignOut={bff.signOut} />
      )}
    </div>
  );
}
