import type { KeyboardEvent } from 'react';
import { Button, Flex, Input, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { GroupSourceAdder } from '../../entities/plugin';
import { useProviderSourceForm } from './useProviderSourceForm';
import styles from './SourceSwitcher.module.css';

// Keys typed here must not drive the select around the form.
const keepKeys = (e: KeyboardEvent) => e.stopPropagation();

/** A source provider's own add form (e.g. a repository to analyse): one field, a button, its error inline. */
export function ProviderSourceForm({ adder }: { adder: GroupSourceAdder }) {
  const { value, change, busy, error, canSend, send } = useProviderSourceForm(adder.submit);

  return (
    <Flex vertical gap={4} className={styles.addForm}>
      <Typography.Text type="secondary" className={styles.addTitle}>
        {adder.label}
      </Typography.Text>
      <Flex gap={6}>
        <Input
          size="small"
          placeholder={adder.placeholder}
          aria-label={adder.label}
          status={error ? 'error' : undefined}
          value={value}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          onKeyDown={keepKeys}
          onPressEnter={() => void send()}
        />
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          loading={busy}
          disabled={!canSend}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void send()}
        >
          Add
        </Button>
      </Flex>
      {error ? (
        <Typography.Text type="danger" className={styles.addTitle} role="alert">
          {error}
        </Typography.Text>
      ) : (
        adder.hint && (
          <Typography.Text type="secondary" className={styles.addTitle}>
            {adder.hint}
          </Typography.Text>
        )
      )}
    </Flex>
  );
}
