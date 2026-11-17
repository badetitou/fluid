import { useState } from 'react';
import { ExpandOutlined } from '@ant-design/icons';
import { Button, Modal } from 'antd';
import type { ViewSpec } from '@fluid/shared';
import { ViewRenderer } from '../../../../views/ViewRenderer';
import styles from './Chat.module.css';

/** A data answer shown inline, with the same view in a larger dialog on demand. */
export function ChatAnswerView({ view }: { view: ViewSpec }) {
  const [large, setLarge] = useState(false);
  return (
    <div className={styles.answerView}>
      <ViewRenderer spec={view} maxColumns={1} />
      <div className={styles.answerActions}>
        <Button size="small" type="link" icon={<ExpandOutlined />} onClick={() => setLarge(true)}>
          Open larger
        </Button>
      </div>
      <Modal open={large} onCancel={() => setLarge(false)} footer={null} width="min(1100px, 92vw)" title={view.title} destroyOnHidden>
        <ViewRenderer spec={view} />
      </Modal>
    </div>
  );
}
