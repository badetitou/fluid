import { useState } from 'react';
import { CodeOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import type { ColumnOverlayProps } from '../../../viewBuilder';
import { ENDPOINT_SETTING } from '../model';
import { ScriptPanel } from './ScriptPanel';
import styles from './Script.module.css';

/**
 * Over every perspective of a detail column, once the Spec-Fluid endpoint is
 * set: a floating menu opening the Pharo script panel, docked at the bottom.
 */
export function ScriptOverlay({ columnKind, itemId, settings }: ColumnOverlayProps) {
  const [open, setOpen] = useState(false);
  const endpoint = settings[ENDPOINT_SETTING];
  if (columnKind !== 'detail' || !itemId || !endpoint) return null;

  if (open) return <ScriptPanel key={itemId} endpoint={endpoint} itemId={itemId} onClose={() => setOpen(false)} />;
  return (
    <FloatButton.Group className={styles.float} trigger="click" icon={<CodeOutlined />} aria-label="Pharo">
      <FloatButton
        icon={<CodeOutlined />}
        tooltip="Smalltalk script on this entity (self)"
        aria-label="Pharo script"
        onClick={() => setOpen(true)}
      />
    </FloatButton.Group>
  );
}
