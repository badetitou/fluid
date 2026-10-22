import { useState } from 'react';
import { Button, Space } from 'antd';
import type { RowAction } from '@fluid/shared';
import { useViewAction, type InvokeAction } from '../plugin-api';

interface RowActionButtonsProps {
  actions: RowAction[];
  row: Record<string, unknown>;
  invoke: InvokeAction;
}

/** The buttons of a table row, each running a view action on the row. */
export function RowActionButtons({ actions, row, invoke }: RowActionButtonsProps) {
  const [running, setRunning] = useState<string | null>(null);
  const run = async (action: string) => {
    setRunning(action);
    await invoke(action, { target: row });
    setRunning(null);
  };
  return (
    // Clicking a button must not also select the row.
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      {actions.map((a) => (
        <RowActionButton key={a.action} action={a} loading={running === a.action} onRun={run} />
      ))}
    </Space>
  );
}

function RowActionButton({
  action,
  loading,
  onRun,
}: {
  action: RowAction;
  loading: boolean;
  onRun: (key: string) => void;
}) {
  const spec = useViewAction(action.action);
  return (
    <Button
      size="small"
      danger={action.danger}
      loading={loading}
      disabled={!spec}
      onClick={() => onRun(action.action)}
    >
      {action.label ?? spec?.label ?? action.action}
    </Button>
  );
}
