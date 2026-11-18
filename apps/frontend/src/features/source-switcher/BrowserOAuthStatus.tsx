import { Alert, Button, Space, Tag, Typography } from 'antd';
import { browserTokenSummary, signInHint, type BrowserOAuth, type BrowserSignIn } from '../../entities/source';
import styles from './SourceSwitcher.module.css';

interface BrowserOAuthStatusProps {
  oauth: BrowserOAuth;
  signIn: BrowserSignIn;
}

/** Whether this tab holds a token for the source (expiry, granted scopes), with "Sign in" and "Sign out". */
export function BrowserOAuthStatus({ oauth, signIn }: BrowserOAuthStatusProps) {
  const { status, error, start } = signIn;
  const hint = error ?? signInHint(status);
  const scopes = oauth.usable ? (oauth.token?.scope?.split(/\s+/).filter(Boolean) ?? []) : [];

  return (
    <Space orientation="vertical" className={styles.full}>
      <Space wrap>
        <Tag color={oauth.usable ? 'success' : 'default'}>{browserTokenSummary(oauth.token, oauth.usable)}</Tag>
        {scopes.map((scope) => (
          <Tag key={scope}>{scope}</Tag>
        ))}
      </Space>
      <Space>
        <Button type={oauth.usable ? 'default' : 'primary'} size="small" onClick={() => start()} loading={status === 'waiting'}>
          {oauth.token ? 'Sign in again' : 'Sign in'}
        </Button>
        {oauth.token && (
          <Button size="small" danger onClick={oauth.signOut}>
            Sign out
          </Button>
        )}
      </Space>
      {hint && status !== 'waiting' ? <Alert type="warning" showIcon title={hint} /> : null}
      {status === 'waiting' && <Typography.Text type="secondary">{hint}</Typography.Text>}
    </Space>
  );
}
