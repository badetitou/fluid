import { useState } from 'react';
import { Checkbox, Modal, Typography } from 'antd';

interface LoadAllDialogProps {
  open: boolean;
  /** Rows already loaded. */
  loaded: number;
  /** Whether the source can page (else every row comes in one answer). */
  paged: boolean;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
}

/** Asks before loading every row of a list, and why it may hurt; with a "don't ask again". */
export function LoadAllDialog({ open, loaded, paged, onConfirm, onCancel }: LoadAllDialogProps) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <Modal
      open={open}
      title="Load every row?"
      okText="Load all"
      onOk={() => onConfirm(dontAsk)}
      onCancel={onCancel}
      destroyOnHidden
      width="min(560px, calc(100vw - 24px))"
    >
      <Typography.Paragraph>
        Only the first {loaded.toLocaleString()} rows are loaded. This list may hold many more: loading them all can
        take long, use a lot of memory in the browser and in the server, and make heavy widgets (graphs, matrices,
        diagrams) slow or unreadable.
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        {paged
          ? 'They are read page by page, as many as the source answers per request.'
          : 'This source cannot page: every row is asked at once, and the source may still cut the answer.'}{' '}
        The row limit of this source is set in Settings → Connection.
      </Typography.Paragraph>
      <Checkbox checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)}>
        Don&apos;t ask again for this source
      </Checkbox>
    </Modal>
  );
}
