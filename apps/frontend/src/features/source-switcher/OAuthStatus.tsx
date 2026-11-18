import { Alert, Button, Space, Tag, Typography } from 'antd';
import { signInHint, useOAuthSignIn, type BffSourceConfig } from '../../entities/source';
import { signInSummary } from './oauthStatusModel';
import styles from './SourceSwitcher.module.css';

interface OAuthStatusProps {
  config: BffSourceConfig;
  busy: boolean;
  /** Called once the popup sign-in succeeded. */
  onSignedIn: (sourceId: string) => void;
  /** Called when the popup went away without a word: the sign-in may have worked, look again. */
  onClosed: () => void;
  onSignOut: () => Promise<boolean>;
}

/** Whether the user is signed in to the source (expiry, granted scopes), with "Sign in" and "Sign out". */
export function OAuthStatus({ config, busy, onSignedIn, onClosed, onSignOut }: OAuthStatusProps) {
  const { status, start } = useOAuthSignIn(config.id, onSignedIn, onClosed);
  const oauth = config.oauth;
  if (config.authKind !== 'oauth' || !oauth) return null;
  const hint = signInHint(status);

  return (
    <Space orientation="vertical" className={styles.full}>
      <Space wrap>
        <Tag color={oauth.signedIn ? 'success' : 'default'}>{signInSummary(oauth)}</Tag>
        {oauth.grantedScopes.map((scope) => (
          <Tag key={scope}>{scope}</Tag>
        ))}
      </Space>
      <Space>
        <Button type={oauth.signedIn ? 'default' : 'primary'} size="small" onClick={() => start()} loading={status === 'waiting'}>
          {oauth.signedIn ? 'Sign in again' : 'Sign in'}
        </Button>
        {oauth.signedIn && (
          <Button size="small" danger onClick={onSignOut} disabled={busy}>
            Sign out
          </Button>
        )}
      </Space>
      {hint && status !== 'waiting' ? <Alert type="warning" showIcon title={hint} /> : null}
      {status === 'waiting' && <Typography.Text type="secondary">{hint}</Typography.Text>}
      <Typography.Text type="secondary">Save the settings above before signing in.</Typography.Text>
    </Space>
  );
}
