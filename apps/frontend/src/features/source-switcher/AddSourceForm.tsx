import { useState, type KeyboardEvent } from 'react';
import { Button, Flex, Input, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { normalizeSourceUrl } from '../../entities/source';
import styles from './SourceSwitcher.module.css';

// Keys typed here must not drive the select around the form.
const keepKeys = (e: KeyboardEvent) => e.stopPropagation();

/** Adds a GraphQL source, named or not, and connects to it. */
export function AddSourceForm({ onAdd }: { onAdd: (url: string, name?: string) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const valid = normalizeSourceUrl(url);
  const invalid = url.trim() !== '' && !valid;

  const submit = () => {
    if (!valid) return;
    onAdd(valid, name);
    setName('');
    setUrl('');
  };

  return (
    <Flex vertical gap={6} className={styles.addForm}>
      <Typography.Text type="secondary" className={styles.addTitle}>
        Add a source
      </Typography.Text>
      <Flex gap={6}>
        <Input
          size="small"
          placeholder="Name (optional)"
          aria-label="Source name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={keepKeys}
          className={styles.addName}
        />
        <Input
          size="small"
          placeholder="https://example.com/graphql"
          aria-label="Source URL"
          status={invalid ? 'error' : undefined}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={keepKeys}
          onPressEnter={submit}
        />
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          disabled={!valid}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
        >
          Add
        </Button>
      </Flex>
    </Flex>
  );
}
