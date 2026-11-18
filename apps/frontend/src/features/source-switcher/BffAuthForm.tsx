import { useState } from 'react';
import { Button, Input, Radio, Space, Tag, Typography } from 'antd';
import { authFormError, authFormOf, type AuthForm, type BffSourceConfig, type OAuthForm } from '../../entities/source';
import { OAuthFields } from './OAuthFields';
import styles from './SourceSwitcher.module.css';

interface BffAuthFormProps {
  config: BffSourceConfig;
  busy: boolean;
  onSave: (form: AuthForm) => Promise<boolean>;
  onRemoveSecret: () => Promise<boolean>;
  onRemoveClientSecret: () => Promise<boolean>;
}

/** How the BFF authenticates to the source: none, a header with a write-only secret, or OAuth. */
export function BffAuthForm({ config, busy, onSave, onRemoveSecret, onRemoveClientSecret }: BffAuthFormProps) {
  const [form, setForm] = useState<AuthForm>(authFormOf(config));
  // A typed client secret does not stay in the form once OAuth is left.
  const change = (patch: Partial<AuthForm>) =>
    setForm((f) => ({
      ...f,
      ...patch,
      ...(patch.authKind && patch.authKind !== 'oauth' ? { oauth: { ...f.oauth, clientSecret: '' } } : {}),
    }));
  const changeOAuth = (patch: Partial<OAuthForm>) => setForm((f) => ({ ...f, oauth: { ...f.oauth, ...patch } }));
  const invalid = authFormError(form);

  // The typed secrets leave the form once the BFF has them; if the save failed they stay to be retried.
  const save = async () => {
    if (await onSave(form)) setForm((f) => ({ ...f, secret: '', oauth: { ...f.oauth, clientSecret: '' } }));
  };

  return (
    <Space orientation="vertical" className={styles.full}>
      <Radio.Group
        value={form.authKind}
        onChange={(e) => change({ authKind: e.target.value })}
        options={[
          { value: 'none', label: 'No authentication' },
          { value: 'header', label: 'Header' },
          { value: 'oauth', label: 'OAuth' },
        ]}
      />
      {form.authKind === 'header' && (
        <>
          <Input
            addonBefore="Header"
            value={form.headerName}
            onChange={(e) => change({ headerName: e.target.value })}
            aria-label="Header name"
          />
          <Space>
            <Input.Password
              value={form.secret}
              onChange={(e) => change({ secret: e.target.value })}
              placeholder={config.hasSecret ? 'Type to replace the secret' : 'Secret (token, API key)'}
              autoComplete="off"
              aria-label="Secret"
            />
            {config.hasSecret && <Tag color="success">secret stored</Tag>}
            {config.hasSecret && (
              <Button size="small" danger onClick={onRemoveSecret} disabled={busy}>
                Remove secret
              </Button>
            )}
          </Space>
          <Typography.Text type="secondary">
            Sent once to the BFF, which keeps it and adds it to each request; it is never shown again.
            An Authorization header is sent as a Bearer token.
          </Typography.Text>
        </>
      )}
      {form.authKind === 'oauth' && (
        <OAuthFields
          value={form.oauth}
          onChange={changeOAuth}
          sourceUrl={config.url}
          hasClientSecret={config.oauth?.hasClientSecret ?? false}
          busy={busy}
          onRemoveClientSecret={onRemoveClientSecret}
        />
      )}
      <Button type="primary" size="small" onClick={save} loading={busy} disabled={invalid !== null} title={invalid ?? undefined}>
        Save
      </Button>
    </Space>
  );
}
