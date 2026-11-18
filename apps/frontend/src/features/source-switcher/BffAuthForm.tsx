import { useState } from 'react';
import { Button, Input, Radio, Space, Tag, Typography } from 'antd';
import { authFormOf, type AuthForm, type BffSourceConfig } from '../../entities/source';
import styles from './SourceSwitcher.module.css';

interface BffAuthFormProps {
  config: BffSourceConfig;
  busy: boolean;
  onSave: (form: AuthForm) => Promise<void>;
  onRemoveSecret: () => Promise<void>;
}

/** How the BFF authenticates to the source: none, or a header with a write-only secret. */
export function BffAuthForm({ config, busy, onSave, onRemoveSecret }: BffAuthFormProps) {
  const [form, setForm] = useState<AuthForm>(authFormOf(config));
  const change = (patch: Partial<AuthForm>) => setForm((f) => ({ ...f, ...patch }));

  // The typed secret leaves the form as soon as it is sent.
  const save = async () => {
    const sent = form;
    setForm({ ...sent, secret: '' });
    await onSave(sent);
  };

  return (
    <Space orientation="vertical" className={styles.full}>
      <Radio.Group
        value={form.authKind}
        onChange={(e) => change({ authKind: e.target.value })}
        options={[
          { value: 'none', label: 'No authentication' },
          { value: 'header', label: 'Header' },
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
      <Button type="primary" size="small" onClick={save} loading={busy}>
        Save
      </Button>
    </Space>
  );
}
