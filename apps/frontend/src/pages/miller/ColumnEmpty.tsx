import { Button, Empty, Flex } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import styles from './MillerColumn.module.css';

interface ColumnEmptyProps {
  loading: boolean;
  /** Offers to create a perspective with the assistant; omitted when the BFF is unreachable. */
  onCreate?: () => void;
}

/** Shown in a column whose concept has no perspective (yet). */
export function ColumnEmpty({ loading, onCreate }: ColumnEmptyProps) {
  return (
    <Flex vertical align="center" justify="center" gap={16} className={styles.empty}>
      <Empty description={loading ? 'Loading perspectives…' : 'No perspective for this concept'} />
      {onCreate && !loading && (
        <Button type="primary" icon={<RobotOutlined />} onClick={onCreate}>
          Create with assistant
        </Button>
      )}
    </Flex>
  );
}
