import { Tag } from 'antd';
import styles from './Network.module.css';

interface NetworkTagLegendProps {
  tags: { tag: string; color?: string }[];
  /** The tag whose nodes are highlighted. */
  active?: string;
  onToggle: (tag: string) => void;
}

/** One chip per decoration tag; clicking one highlights the nodes carrying it. */
export function NetworkTagLegend({ tags, active, onToggle }: NetworkTagLegendProps) {
  if (tags.length === 0) return null;
  return (
    <div className={styles.legend} role="group" aria-label="Tags">
      {tags.map(({ tag, color }) => (
        <Tag
          key={tag}
          className={active === tag ? styles.chipActive : styles.chip}
          color={color}
          bordered={active === tag}
          onClick={() => onToggle(tag)}
        >
          {tag}
        </Tag>
      ))}
    </div>
  );
}
