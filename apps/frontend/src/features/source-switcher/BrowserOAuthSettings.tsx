import { Alert, Space, Typography } from 'antd';
import { useBrowserOAuth, useBrowserSignIn } from '../../entities/source';
import type { SourceAuth } from '../../entities/plugin';
import { BrowserOAuthForm } from './BrowserOAuthForm';
import { BrowserOAuthStatus } from './BrowserOAuthStatus';
import styles from './SourceSwitcher.module.css';

interface BrowserOAuthSettingsProps {
  url: string;
  /** No BFF to sign in through: the browser-only sign-in is offered (kept settings are always shown). */
  offered: boolean;
  suggested?: SourceAuth;
}

/** Sign in to a direct source from the page itself, as a public OAuth client: a demo mode for deployments without a BFF. */
export function BrowserOAuthSettings({ url, offered, suggested }: BrowserOAuthSettingsProps) {
  const oauth = useBrowserOAuth(url);
  const signIn = useBrowserSignIn(url);
  if (!offered && !oauth.settings) return null;

  return (
    <Space orientation="vertical" className={styles.full}>
      <Typography.Text strong>Sign in from the browser (demo)</Typography.Text>
      <Alert
        type="warning"
        showIcon
        title="For demos only"
        description="Without a BFF, this page signs in to the source itself. The access token stays in this tab’s memory, where plugins can read it, and is lost on reload. Use the BFF for real deployments."
      />
      <BrowserOAuthForm
        key={`${url}|${JSON.stringify(oauth.settings ?? null)}`}
        settings={oauth.settings}
        suggested={suggested}
        onSave={oauth.save}
        onRemove={oauth.remove}
      />
      {oauth.settings && <BrowserOAuthStatus oauth={oauth} signIn={signIn} />}
    </Space>
  );
}
