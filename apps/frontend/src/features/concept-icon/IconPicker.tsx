import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, Popover, Tooltip } from 'antd';
import { CONCEPT_ICONS } from './icons';
import styles from './ConceptIcon.module.css';

/** Keeps clicks from reaching the parent Link: popover content is portalled, but React events still bubble. */
const swallow = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

interface IconPickerProps {
  /** What the icon belongs to, shown in the popover title and labels. */
  name: string;
  /** Chosen icon key, undefined for the default. */
  icon: string | undefined;
  onChange: (icon: string | null) => void;
  children: ReactNode;
}

/**
 * Wraps a trigger (usually the current icon) with a popover grid to pick
 * another icon. Clicks are kept from bubbling so it works inside links, cards
 * and menus.
 */
export function IconPicker({ name, icon, onChange, children }: IconPickerProps) {
  const [open, setOpen] = useState(false);

  const choose = (key: string | null) => {
    onChange(key);
    setOpen(false);
  };

  const content = (
    <div onClick={swallow} className={styles.panel}>
      <div className={styles.grid}>
        {Object.entries(CONCEPT_ICONS).map(([key, Icon]) => (
          <Tooltip key={key} title={key} mouseEnterDelay={0.5}>
            <Button
              type={key === icon ? 'primary' : 'text'}
              size="small"
              aria-label={`Use ${key} icon`}
              icon={<Icon />}
              onClick={() => choose(key)}
            />
          </Tooltip>
        ))}
      </div>
      <Button
        type="link"
        size="small"
        disabled={!icon}
        onClick={() => choose(null)}
        className={styles.reset}
      >
        Reset to default
      </Button>
    </div>
  );

  return (
    <Popover
      title={`Icon for ${name}`}
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={`Change icon of ${name}`}
        onClick={swallow}
        className={styles.trigger}
      >
        {children}
      </span>
    </Popover>
  );
}
