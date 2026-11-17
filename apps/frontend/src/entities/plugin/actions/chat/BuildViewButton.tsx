import { useState } from 'react';
import { DashboardOutlined } from '@ant-design/icons';
import { Button, Input, Popover, Space } from 'antd';
import { isGraphConcept } from '@fluid/shared';
import type { BuildViewChoice } from './useBuildView';
import styles from './Chat.module.css';

interface BuildViewButtonProps {
  /** The column's concept: a view of the whole graph is a dashboard already. */
  concept: string;
  disabled: boolean;
  onBuild: (choice: BuildViewChoice) => void;
}

/** "Build a view from this conversation": an optional instruction, then a perspective of the column or a dashboard. */
export function BuildViewButton({ concept, disabled, onBuild }: BuildViewButtonProps) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState('');
  const graph = isGraphConcept(concept);
  const build = (asDashboard: boolean) => {
    setOpen(false);
    onBuild({ extra, asDashboard });
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      title="Build a view from this conversation"
      content={
        <div className={styles.build}>
          <Input.TextArea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 5 }}
            placeholder="Anything to add? (optional)"
          />
          <Space wrap>
            <Button type="primary" onClick={() => build(graph)}>
              {graph ? 'Build a dashboard' : `As a perspective of ${concept}`}
            </Button>
            {!graph && <Button onClick={() => build(true)}>As a new dashboard</Button>}
          </Space>
        </div>
      }
    >
      <Button size="small" icon={<DashboardOutlined />} disabled={disabled}>
        Build a view
      </Button>
    </Popover>
  );
}
