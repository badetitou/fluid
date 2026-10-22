import { ConceptCatalog } from '../../features/concept-catalog';
import { MillerColumnPathContext } from '../../navigation/columnPath';
import { ColumnActions } from './ColumnActions';
import { ColumnHeader } from './ColumnHeader';
import type { ColumnMode } from './MillerColumnBody';
import type { ColumnConfig } from './model';
import styles from './MillerColumn.module.css';

const PAGE_SUBTITLE =
  'The concepts exposed by the root of your data source, plus the ones you pinned. Pick one to open its work list.';

interface ConceptsColumnProps {
  column: ColumnConfig;
  mode: ColumnMode;
  onToggleFullscreen: (slot: string) => void;
}

/**
 * The Concepts dashboard: a custom page listing the source's concepts. Opening
 * one (a card) turns it into the first column of a Miller view.
 */
export function ConceptsColumn({ column: { path, slot }, mode, onToggleFullscreen }: ConceptsColumnProps) {
  const isFullscreen = mode !== 'column';
  const actions =
    mode === 'page' ? undefined : (
      <ColumnActions menu={null} isFullscreen={isFullscreen} onToggleFullscreen={() => onToggleFullscreen(slot)} />
    );

  return (
    <MillerColumnPathContext.Provider value={path}>
      <ColumnHeader
        title="Concepts"
        subtitle={mode === 'page' ? PAGE_SUBTITLE : 'Data source'}
        actions={actions}
        page={mode === 'page'}
      />
      <div className={styles.body}>
        <div className={styles.padded}>
          <ConceptCatalog narrow={!isFullscreen} />
        </div>
      </div>
    </MillerColumnPathContext.Provider>
  );
}
