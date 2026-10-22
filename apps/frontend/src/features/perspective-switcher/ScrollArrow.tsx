import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import styles from './PerspectivePills.module.css';

interface ScrollArrowProps {
  direction: -1 | 1;
  onScroll: (direction: -1 | 1) => void;
}

/** Small chevron scrolling the pill bar by one step. */
export function ScrollArrow({ direction, onScroll }: ScrollArrowProps) {
  const label = direction < 0 ? 'Previous views' : 'Next views';
  return (
    <button type="button" aria-label={label} className={styles.arrow} onClick={() => onScroll(direction)}>
      {direction < 0 ? <LeftOutlined /> : <RightOutlined />}
    </button>
  );
}
