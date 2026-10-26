import type { ReactNode } from 'react';
import { useActiveColumnOverlays } from '../../entities/plugin';
import { PageActions } from '../../features/page-actions';
import type { ColumnKind } from '../../views/viewScope';
import styles from './MillerColumn.module.css';

interface ColumnStageProps {
  concept: string;
  columnKind: ColumnKind;
  itemId?: string;
  /** Plugins draw nothing over the body (layout editing, presentation): no overlay, no floating button. */
  bare?: boolean;
  children: ReactNode;
}

/**
 * The body of a column, with what the enabled plugins draw over it: the
 * column overlays of the view builders, and the floating button of the page actions.
 */
export function ColumnStage({ concept, columnKind, itemId, bare, children }: ColumnStageProps) {
  const overlays = useActiveColumnOverlays();
  return (
    <div className={styles.stage}>
      {children}
      {!bare &&
        overlays.map(({ id, Overlay, settings }) => (
          <Overlay key={id} concept={concept} columnKind={columnKind} itemId={itemId} settings={settings} />
        ))}
      {!bare && <PageActions concept={concept} columnKind={columnKind} itemId={itemId} />}
    </div>
  );
}
