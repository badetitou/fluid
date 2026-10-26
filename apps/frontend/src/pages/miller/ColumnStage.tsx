import type { ReactNode } from 'react';
import { useActiveColumnOverlays } from '../../entities/plugin';
import type { ColumnKind } from '../../views/viewScope';
import styles from './MillerColumn.module.css';

interface ColumnStageProps {
  concept: string;
  columnKind: ColumnKind;
  itemId?: string;
  /** Plugins draw nothing over the body (layout editing, presentation). */
  bare?: boolean;
  children: ReactNode;
}

/** The body of a column, with what the enabled view builders draw over it (their column overlays). */
export function ColumnStage({ concept, columnKind, itemId, bare, children }: ColumnStageProps) {
  const overlays = useActiveColumnOverlays();
  return (
    <div className={styles.stage}>
      {children}
      {!bare &&
        overlays.map(({ id, Overlay, settings }) => (
          <Overlay key={id} concept={concept} columnKind={columnKind} itemId={itemId} settings={settings} />
        ))}
    </div>
  );
}
