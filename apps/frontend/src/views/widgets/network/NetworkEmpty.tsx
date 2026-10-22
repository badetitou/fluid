import { Empty } from 'antd';
import styles from './Network.module.css';

/** In place of the network, why there is none (no rows, no ids…), at the widget's height. */
export function NetworkEmpty({ height, reason }: { height: number; reason: string }) {
  return (
    <div className={styles.empty} style={{ height }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={reason} />
    </div>
  );
}
