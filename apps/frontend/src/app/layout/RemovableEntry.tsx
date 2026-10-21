import { Link } from 'react-router-dom';
import { Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import styles from './AppLayout.module.css';

interface RemovableEntryProps {
  to: string;
  label: string;
  /** Tooltip of the remove button, e.g. "Unpin". */
  removeLabel: string;
  onRemove: () => void;
}

/** A bar entry the user added (pinned concept, dashboard): a link with a remove button. */
export function RemovableEntry({ to, label, removeLabel, onRemove }: RemovableEntryProps) {
  return (
    <span className={styles.pinned}>
      <Link to={to} className={styles.pinnedLink}>
        {label}
      </Link>
      <Tooltip title={removeLabel}>
        <CloseOutlined
          aria-label={`${removeLabel} ${label}`}
          className={styles.unpin}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        />
      </Tooltip>
    </span>
  );
}
