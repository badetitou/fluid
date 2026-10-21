import { useState } from 'react';
import { Button, Flex, Select, Tag, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { DEMO_SOURCES } from './demoSources';
import styles from './ConnectPage.module.css';

/** Picks one of the public demo sources and connects to it. */
export function DemoPicker({ onConnect }: { onConnect: (url: string) => void }) {
  const [demoKey, setDemoKey] = useState(DEMO_SOURCES[0].key);
  const demo = DEMO_SOURCES.find((d) => d.key === demoKey) ?? DEMO_SOURCES[0];

  return (
    <Flex vertical gap={12}>
      <ol className={styles.steps}>
        <li>Pick a demo API: Fluid reads its schema and lists its concepts.</li>
        <li>Open a concept to get a list generated automatically, then click a row to drill into it.</li>
        <li>
          Each column is a <em>perspective</em>: use its <code>⋯</code> menu to create one with the AI
          assistant, or pin a deeper concept to the sidebar.
        </li>
      </ol>
      <Select
        size="large"
        value={demoKey}
        onChange={setDemoKey}
        options={DEMO_SOURCES.map((d) => ({ value: d.key, label: d.label }))}
      />
      <Flex vertical gap={6}>
        <Typography.Text type="secondary">{demo.description}</Typography.Text>
        <Flex wrap gap={4}>
          {demo.concepts.map((c) => (
            <Tag key={c} color="blue" className={styles.tag}>
              {c}
            </Tag>
          ))}
        </Flex>
      </Flex>
      <Button size="large" icon={<PlayCircleOutlined />} block onClick={() => onConnect(demo.url)}>
        Explore the {demo.label} demo
      </Button>
      <Typography.Text type="secondary" className={styles.small}>
        Endpoint: <code>{demo.url}</code>. You can switch sources later from the settings.
      </Typography.Text>
    </Flex>
  );
}
