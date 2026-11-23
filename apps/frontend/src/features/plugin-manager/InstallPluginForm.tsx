import { useState } from 'react';
import { Alert, Button, Input, Space, Typography } from 'antd';
import { contributionLabel } from '../../entities/plugin';
import { useInstallPlugin } from './useInstallPlugin';
import styles from './PluginManager.module.css';

/** Example plugins served by fluid itself (`public/plugins/`). */
const EXAMPLES = ['tagcloud', 'nord-theme'].map(
  (id) => `${import.meta.env.BASE_URL}plugins/${id}/manifest.json`,
);

/** Installs a plugin from the URL of its manifest, after showing what it contains. */
export function InstallPluginForm() {
  const [url, setUrl] = useState('');
  const { inspecting, pending, error, check, confirm, cancel } = useInstallPlugin();
  const runsCode = !!pending?.manifest.module;

  return (
    <Space orientation="vertical" className={styles.list}>
      <div className={styles.form}>
        <Input
          placeholder="https://example.org/my-plugin/manifest.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPressEnter={() => check(url)}
          aria-label="Plugin manifest URL"
        />
        <Button onClick={() => check(url)} loading={inspecting} disabled={!url.trim()}>
          Add
        </Button>
      </div>
      <Typography.Text type="secondary" className={styles.examples}>
        Examples:{' '}
        {EXAMPLES.map((example) => (
          <Typography.Link key={example} onClick={() => setUrl(example)}>
            {example}{' '}
          </Typography.Link>
        ))}
      </Typography.Text>
      {error && (
        <Alert type="error" showIcon title="Cannot install this plugin" description={error} />
      )}
      {pending && (
        <Alert
          type={runsCode ? 'warning' : 'info'}
          showIcon
          title={`${pending.manifest.name} v${pending.manifest.version} — ${contributionLabel(pending.manifest)}`}
          description={
            runsCode
              ? 'This plugin runs its own code in fluid: it can read the data you browse and your settings, LLM key included. Only install plugins you trust.'
              : `This plugin only contains ${contributionLabel(pending.manifest)} (no code).`
          }
          action={
            <Space orientation="vertical">
              <Button size="small" type="primary" onClick={confirm}>
                Install
              </Button>
              <Button size="small" onClick={cancel}>
                Cancel
              </Button>
            </Space>
          }
        />
      )}
    </Space>
  );
}
