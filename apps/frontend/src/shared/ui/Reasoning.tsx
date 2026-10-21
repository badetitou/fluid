import { Collapse, Timeline, Typography } from 'antd';
import styles from './Reasoning.module.css';

/** The model's reasoning steps, folded behind a "Reasoning" toggle. */
export function Reasoning({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <Collapse
      size="small"
      ghost
      items={[
        {
          key: 'reasoning',
          label: (
            <Typography.Text type="secondary" className={styles.small}>
              Reasoning
            </Typography.Text>
          ),
          children: (
            <Timeline
              items={steps.map((step) => ({
                content: <Typography.Text className={styles.small}>{step}</Typography.Text>,
              }))}
            />
          ),
        },
      ]}
    />
  );
}
