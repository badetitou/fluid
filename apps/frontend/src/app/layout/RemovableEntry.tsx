import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Tooltip, type InputRef } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import styles from './AppLayout.module.css';

interface RemovableEntryProps {
  to: string;
  label: string;
  /** Tooltip of the remove button, e.g. "Unpin". */
  removeLabel: string;
  onRemove: () => void;
  /** When given, double-clicking the label edits it in place. */
  onRename?: (label: string) => void;
}

/**
 * A bar entry the user added (pinned concept, dashboard): a link with a remove
 * button, renamable by double-click when `onRename` is given.
 */
export function RemovableEntry({ to, label, removeLabel, onRemove, onRename }: RemovableEntryProps) {
  const [editing, setEditing] = useState(false);
  const input = useRef<InputRef>(null);

  useEffect(() => {
    if (editing) input.current?.focus({ cursor: 'all' });
  }, [editing]);

  if (editing && onRename) {
    return (
      <Input
        ref={input}
        size="small"
        defaultValue={label}
        aria-label={`Rename ${label}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Keep the menu from handling keys (arrows, space) typed in the field.
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.currentTarget.value = label;
            e.currentTarget.blur();
          }
        }}
        onPressEnter={(e) => e.currentTarget.blur()}
        onBlur={(e) => {
          if (e.currentTarget.value !== label) onRename(e.currentTarget.value);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <span className={styles.pinned}>
      <Link
        to={to}
        className={styles.pinnedLink}
        onDoubleClick={
          onRename
            ? (e) => {
                e.preventDefault();
                setEditing(true);
              }
            : undefined
        }
      >
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
