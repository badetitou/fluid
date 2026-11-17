import type { ReactNode } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { ViewSeed } from '../../entities/llm';
import { useActiveColumnOverlays } from '../../entities/plugin';
import { PageActions } from '../../features/page-actions';
import type { ColumnKind } from '../../views/viewScope';
import styles from './MillerColumn.module.css';

interface ColumnStageProps {
  concept: string;
  columnKind: ColumnKind;
  itemId?: string;
  /** The view the column shows, for the page actions that talk about it. */
  view?: ViewSpec | null;
  /** Plugins draw nothing over the body (layout editing, presentation): no overlay, no floating button. */
  bare?: boolean;
  /** Opens the column's view assistant pre-filled (the chat's "Build a view"). */
  openViewAssistant?: (seed: ViewSeed) => void;
  children: ReactNode;
}

/**
 * The body of a column, with what the enabled plugins draw over it: the
 * column overlays of the view builders, and the floating button of the page actions.
 */
export function ColumnStage({ concept, columnKind, itemId, view, bare, openViewAssistant, children }: ColumnStageProps) {
  const overlays = useActiveColumnOverlays();
  return (
    <div className={styles.stage}>
      {children}
      {!bare &&
        overlays.map(({ id, Overlay, settings }) => (
          <Overlay key={id} concept={concept} columnKind={columnKind} itemId={itemId} settings={settings} />
        ))}
      {!bare && (
        <PageActions
          concept={concept}
          columnKind={columnKind}
          itemId={itemId}
          view={view ?? undefined}
          openViewAssistant={openViewAssistant}
        />
      )}
    </div>
  );
}
