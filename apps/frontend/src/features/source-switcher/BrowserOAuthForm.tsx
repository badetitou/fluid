import { useState } from 'react';
import { Button, Input, Space, Typography } from 'antd';
import {
  browserFormOf,
  browserSettingsOf,
  pageRedirectUri,
  type BrowserOAuthForm as Form,
  type BrowserOAuthSettings,
} from '../../entities/source';
import type { SourceAuth } from '../../entities/plugin';
import styles from './SourceSwitcher.module.css';

interface BrowserOAuthFormProps {
  settings: BrowserOAuthSettings | undefined;
  /** The settings the source's plugin ships, to start from when none are kept. */
  suggested?: SourceAuth;
  onSave: (settings: BrowserOAuthSettings) => void;
  onRemove: () => void;
}

/** The public client settings of a browser-only sign-in: issuer, client id, scopes, resource, and the redirect URI to register. */
export function BrowserOAuthForm({ settings, suggested, onSave, onRemove }: BrowserOAuthFormProps) {
  const [form, setForm] = useState<Form>(browserFormOf(settings, suggested));
  const change = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const parsed = browserSettingsOf(form);
  const invalid = 'error' in parsed ? parsed.error : null;

  return (
    <Space orientation="vertical" className={styles.full}>
      <Input
        addonBefore="Issuer"
        value={form.issuer}
        onChange={(e) => change({ issuer: e.target.value })}
        placeholder="https://auth.example.com"
        aria-label="Browser issuer"
      />
      <Input
        addonBefore="Client id"
        value={form.clientId}
        onChange={(e) => change({ clientId: e.target.value })}
        autoComplete="off"
        placeholder="A public client (no secret)"
        aria-label="Browser client id"
      />
      <Input
        addonBefore="Scopes"
        value={form.scopes}
        onChange={(e) => change({ scopes: e.target.value })}
        placeholder="read write (space-separated)"
        aria-label="Browser scopes"
      />
      <Input
        addonBefore="Resource"
        value={form.resource}
        onChange={(e) => change({ resource: e.target.value })}
        placeholder="Audience of the tokens (optional)"
        aria-label="Browser resource"
      />
      <Typography.Text type="secondary">
        Register this redirect URI for the client, and allow this site’s origin (CORS) on the token endpoint:{' '}
        <Typography.Text copyable code>
          {pageRedirectUri()}
        </Typography.Text>
      </Typography.Text>
      <Space>
        <Button
          type="primary"
          size="small"
          disabled={invalid !== null}
          title={invalid ?? undefined}
          onClick={() => !('error' in parsed) && onSave(parsed)}
        >
          Save
        </Button>
        {settings && (
          <Button size="small" danger onClick={onRemove}>
            Remove
          </Button>
        )}
      </Space>
    </Space>
  );
}
