import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MillerColumn } from './MillerColumn';
import { MillerListLayout } from './MillerListLayout';
import { buildColumns, columnTitle, type NavigationNode } from './model';

interface MillerListViewProps {
  rootConceptName: string;
  navigationStack: NavigationNode[];
}

/**
 * Renders the Miller split-view: one column per level of navigation.
 * - First column: the root concept's work list.
 * - Additional columns: the drilled-in entity for each navigation level.
 *
 * Each column is an independent <MillerColumn> component, so a variable number
 * of columns never changes the hook count of any single component (this is what
 * previously crashed the page into a blank screen). Columns are memoised and get
 * stable callbacks: opening a new column does not re-render the others.
 *
 * Any column can be expanded to full screen; while one is expanded the others
 * are hidden and the expanded column lays its widgets out on a multi-column grid.
 */
export function MillerListView({ rootConceptName, navigationStack }: MillerListViewProps) {
  const navigate = useNavigate();
  const [fullscreenPath, setFullscreenPath] = useState<string | null>(null);
  const columns = useMemo(() => buildColumns(rootConceptName, navigationStack), [rootConceptName, navigationStack]);

  const close = useCallback((parentPath: string) => navigate(parentPath), [navigate]);
  const toggleFullscreen = useCallback(
    (path: string) => setFullscreenPath((prev) => (prev === path ? null : path)),
    [],
  );

  // A stale full-screen path (after closing/navigating) simply shows every column.
  const active = columns.some((c) => c.path === fullscreenPath) ? fullscreenPath : null;
  const visible = active ? columns.filter((c) => c.path === active) : columns;

  return (
    <MillerListLayout labels={visible.map(columnTitle)}>
      {visible.map((c) => (
        <MillerColumn
          key={c.path}
          conceptName={c.conceptName}
          itemId={c.itemId}
          path={c.path}
          parentPath={c.parentPath}
          isFullscreen={c.path === active}
          onToggleFullscreen={toggleFullscreen}
          onClose={close}
        />
      ))}
    </MillerListLayout>
  );
}
