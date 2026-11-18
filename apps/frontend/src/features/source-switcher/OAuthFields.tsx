import { Alert, Button, Input, Space, Tag, Typography } from 'antd';
import { applyDiscovery, useOAuthDiscovery, type OAuthForm } from '../../entities/source';
import styles from './SourceSwitcher.module.css';

interface OAuthFieldsProps {
  value: OAuthForm;
  onChange: (patch: Partial<OAuthForm>) => void;
  /** The source's GraphQL URL, which "Discover" asks the BFF about. */
  sourceUrl: string;
  hasClientSecret: boolean;
  busy: boolean;
  onRemoveClientSecret: () => Promise<boolean>;
}

/** The OAuth settings of a source: issuer, client, write-only client secret, scopes, resource, and "Discover". */
export function OAuthFields({ value, onChange, sourceUrl, hasClientSecret, busy, onRemoveClientSecret }: OAuthFieldsProps) {
  const discovery = useOAuthDiscovery();
  const discover = async () => {
    const found = await discovery.discover(sourceUrl, value.issuer);
    if (found) onChange(applyDiscovery(value, found));
  };

  return (
    <Space orientation="vertical" className={styles.full}>
      <Space.Compact className={styles.full}>
        <Input
          addonBefore="Issuer"
          value={value.issuer}
          onChange={(e) => onChange({ issuer: e.target.value })}
          placeholder="https://auth.example.com"
          aria-label="Issuer"
        />
        <Button onClick={discover} loading={discovery.busy}>
          Discover
        </Button>
      </Space.Compact>
      {discovery.error && <Alert type="warning" showIcon title={discovery.error} />}
      <Input
        addonBefore="Client id"
        value={value.clientId}
        onChange={(e) => onChange({ clientId: e.target.value })}
        autoComplete="off"
        aria-label="Client id"
      />
      <Space>
        <Input.Password
          value={value.clientSecret}
          onChange={(e) => onChange({ clientSecret: e.target.value })}
          placeholder={hasClientSecret ? 'Type to replace the client secret' : 'Client secret (if the client has one)'}
          autoComplete="off"
          aria-label="Client secret"
        />
        {hasClientSecret && <Tag color="success">secret stored</Tag>}
        {hasClientSecret && (
          <Button size="small" danger onClick={onRemoveClientSecret} disabled={busy}>
            Remove secret
          </Button>
        )}
      </Space>
      <Input
        addonBefore="Scopes"
        value={value.scopes}
        onChange={(e) => onChange({ scopes: e.target.value })}
        placeholder="read write (space-separated)"
        aria-label="Scopes"
      />
      <Input
        addonBefore="Resource"
        value={value.resource}
        onChange={(e) => onChange({ resource: e.target.value })}
        placeholder="Audience of the tokens (optional)"
        aria-label="Resource"
      />
      <Typography.Text type="secondary">
        The BFF keeps the client secret and the tokens: the browser never sees them. Changing these settings signs you out.
      </Typography.Text>
    </Space>
  );
}
