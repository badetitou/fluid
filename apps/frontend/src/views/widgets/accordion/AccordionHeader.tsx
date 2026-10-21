import type { MouseEvent } from 'react';
import type { Column } from '@fluid/shared';
import { useCellRenderer } from '../useCellRenderer';
import type { Row } from './accordionModel';
import styles from './Accordion.module.css';

interface AccordionHeaderProps {
  label: string;
  row: Row;
  summary?: Column[];
}

// A link in the summary opens the element: it must not also fold the panel.
const stop = (event: MouseEvent) => event.stopPropagation();

/** A panel's header: the element's label, then its summary fields formatted like table cells. */
export function AccordionHeader({ label, row, summary }: AccordionHeaderProps) {
  const renderCell = useCellRenderer();
  return (
    <div className={styles.header}>
      <span className={styles.label}>{label}</span>
      {summary?.length ? (
        <span className={styles.summary} onClick={stop}>
          {summary.map((col) => (
            <span key={col.key}>
              {col.title && <span className={styles.summaryTitle}>{col.title}</span>}
              {renderCell(col, row)}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}
