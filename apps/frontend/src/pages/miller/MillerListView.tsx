import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreselectContext, readPreselect } from '../../entities/dashboard';
import { ConceptsColumn } from './ConceptsColumn';
import { MillerColumn } from './MillerColumn';
import type { ColumnMode } from './MillerColumnBody';
import { MillerListLayout } from './MillerListLayout';
import { columnTitle, type ColumnConfig } from './model';

interface MillerListViewProps {
  /** The dashboard, then one column per link followed from it. */
  columns: ColumnConfig[];
}

/**
 * Renders a dashboard and the columns opened from it. Alone, the dashboard is
 * a page; following a link turns the view into Miller columns, the dashboard
 * staying mounted as the first one (so its state survives the change).
 *
 * Each column is an independent component, so a variable number of columns
 * never changes the hook count of any single component. Columns are memoised
 * and get stable callbacks: opening a new column does not re-render the others.
 *
 * Any column can be expanded to full screen; while one is expanded the others
 * are hidden and the expanded column lays its widgets out on a multi-column grid.
 */
export function MillerListView({ columns }: MillerListViewProps) {
  const navigate = useNavigate();
  // "New dashboard" asks the column it opens to start the assistant.
  const { state } = useLocation();
  const preselect = useMemo(() => readPreselect(state), [state]);
  const [fullscreenPath, setFullscreenPath] = useState<string | null>(null);

  const close = useCallback((parentPath: string) => navigate(parentPath), [navigate]);
  const toggleFullscreen = useCallback(
    (path: string) => setFullscreenPath((prev) => (prev === path ? null : path)),
    [],
  );

  // A stale full-screen path (after closing/navigating) simply shows every column.
  const active = columns.some((c) => c.path === fullscreenPath) ? fullscreenPath : null;
  const visible = active ? columns.filter((c) => c.path === active) : columns;
  const modeOf = (c: ColumnConfig): ColumnMode =>
    columns.length === 1 ? 'page' : c.path === active ? 'fullscreen' : 'column';

  return (
    <PreselectContext.Provider value={preselect}>
      <MillerListLayout labels={visible.map(columnTitle)}>
        {visible.map((c) =>
          c.kind === 'home' ? (
            <ConceptsColumn key={c.path} path={c.path} mode={modeOf(c)} onToggleFullscreen={toggleFullscreen} />
          ) : (
            <MillerColumn
              key={c.path}
              column={c}
              mode={modeOf(c)}
              onToggleFullscreen={toggleFullscreen}
              onClose={close}
            />
          ),
        )}
      </MillerListLayout>
    </PreselectContext.Provider>
  );
}
