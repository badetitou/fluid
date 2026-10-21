import { useMemo } from 'react';
import { Alert, BorderBeam, Checkbox, Empty, Flex, Space, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { conceptLabel } from '@fluid/shared';
import { injectItemId } from '../../entities/view';
import { ViewRenderer } from '../../views/ViewRenderer';
import type { AssistantSession, AssistantTarget } from './useAssistantSession';
import { VersionSelect } from './VersionSelect';
import styles from './ViewAssistant.module.css';

interface AssistantPreviewProps {
  session: AssistantSession;
  target: AssistantTarget;
  isDefault: boolean;
  onDefaultChange: (isDefault: boolean) => void;
  saveError: string | null;
}

/** Right pane of the assistant: the selected version rendered live. */
export function AssistantPreview({ session, target, isDefault, onDefaultChange, saveError }: AssistantPreviewProps) {
  const { spec, specs, activeVersion, latestVersion } = session;
  const { itemId, byIdField } = target;
  // Rendered with the data of the item the column was opened on, as once saved.
  const shown = useMemo(() => spec && injectItemId(spec, byIdField, itemId), [spec, byIdField, itemId]);
  const generating = session.pending !== null;

  return (
    <div className={styles.preview}>
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Space size={8}>
          <Typography.Text strong>Preview</Typography.Text>
          {activeVersion !== null && (
            <VersionSelect
              versions={[...specs.keys()]}
              value={activeVersion}
              latest={latestVersion}
              onChange={session.select}
            />
          )}
          {generating && (
            <Typography.Text type="secondary" className={styles.small}>
              <LoadingOutlined /> generating a new version…
            </Typography.Text>
          )}
        </Space>
        {spec && (
          <Checkbox checked={isDefault} onChange={(e) => onDefaultChange(e.target.checked)}>
            Default view for {conceptLabel(target.concept)}
          </Checkbox>
        )}
      </Flex>
      {saveError && <Alert type="error" showIcon title="Save failed" description={saveError} />}
      <BorderBeam className={generating ? undefined : styles.hidden} lineWidth={2}>
        <div className={`${styles.canvas} ${generating ? styles.dimmed : ''}`}>
          {shown ? (
            <ViewRenderer key={`${activeVersion}-${shown.id}`} spec={shown} />
          ) : (
            <div className={styles.centered}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  generating
                    ? 'The assistant is building your view…'
                    : 'No preview yet — describe a view in the chat.'
                }
              />
            </div>
          )}
        </div>
      </BorderBeam>
    </div>
  );
}
