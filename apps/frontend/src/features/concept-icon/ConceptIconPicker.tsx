import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, Popover, Tooltip } from 'antd';
import { CONCEPT_ICONS } from './icons';
import { useConceptIcon } from './useConceptIcon';
import styles from './ConceptIcon.module.css';

/** Keeps clicks from reaching the parent Link: popover content is portalled, but React events still bubble. */
const swallow = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Wraps a trigger (usually a ConceptIcon) with a popover grid to pick another
 * icon. Clicks are kept from bubbling so it works inside links and cards.
 */
export function ConceptIconPicker({ name, children }: { name: string; children: ReactNode }) {
  const { icon, setIcon } = useConceptIcon(name);
  const [open, setOpen] = useState(false);

  const choose = (key: string | null) => {
    setIcon(key);
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
