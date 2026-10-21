import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MillerColumn } from '../components/MillerColumn';
import { MillerListLayout } from '../components/MillerListLayout';

interface NavigationNode {
  conceptName: string;
  itemId: string;
}

interface MillerListViewProps {
  rootConceptName: string;
  navigationStack: NavigationNode[];
}

interface ColumnConfig {
  id: string;
  conceptName: string;
  itemId?: string;
  /** Miller path of this column; links inside it open the next column after it. */
  path: string;
  title: string;
  subtitle: string;
  onClose?: () => void;
}

/**
 * Renders the Miller split-view: one column per level of navigation.
 * - First column: the root concept's work list.
 * - Additional columns: the drilled-in entity for each navigation level.
 *
 * Each column is an independent <MillerColumn> component, so a variable number
 * of columns never changes the hook count of any single component (this is what
 * previously crashed the page into a blank screen). Each column also introspects
 * its own concept on demand.
 *
 * Any column can be expanded to full screen; while one is expanded the others
 * are hidden and the expanded column lays its widgets out on a multi-column grid.
 */
export function MillerListView({ rootConceptName, navigationStack }: MillerListViewProps) {
  const navigate = useNavigate();
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const rootPath = `/miller/${rootConceptName}`;
  const configs: ColumnConfig[] = [
    {
      id: `root-${rootConceptName}`,
      conceptName: rootConceptName,
      path: rootPath,
      title: `${rootConceptName} (work list)`,
      subtitle: `Entity Type: ${rootConceptName}`,
    },
  ];

  navigationStack.forEach((nav, stackIndex) => {
    const handleClose = () => {
      const remaining = navigationStack.slice(0, stackIndex);
      if (remaining.length === 0) {
        navigate(`/miller/${rootConceptName}`);
      } else {
        const path = remaining.map((n) => `${n.conceptName}/${n.itemId}`).join('/');
        navigate(`/miller/${rootConceptName}/${path}`);
      }
    };

    configs.push({
      id: `lvl-${stackIndex}-${nav.conceptName}-${nav.itemId}`,
      conceptName: nav.conceptName,
      itemId: nav.itemId,
      path: `${configs[configs.length - 1].path}/${nav.conceptName}/${encodeURIComponent(nav.itemId)}`,
      title: `${nav.conceptName}: ${nav.itemId}`,
      subtitle: `Entity Type: ${nav.conceptName}`,
      onClose: handleClose,
    });
  });

  // Derive the active fullscreen column so a stale id (after closing/navigating)
  // simply falls back to showing every column.
  const activeFullscreen =
    fullscreenId && configs.some((c) => c.id === fullscreenId) ? fullscreenId : null;
  const visible = activeFullscreen ? configs.filter((c) => c.id === activeFullscreen) : configs;

  return (
    <MillerListLayout labels={visible.map((c) => c.title)}>
      {visible.map((cfg) => (
        <MillerColumn
          key={cfg.id}
          conceptName={cfg.conceptName}
          itemId={cfg.itemId}
          path={cfg.path}
          title={cfg.title}
          subtitle={cfg.subtitle}
          onClose={cfg.onClose}
          isFullscreen={cfg.id === activeFullscreen}
          onToggleFullscreen={() =>
            setFullscreenId((prev) => (prev === cfg.id ? null : cfg.id))
          }
        />
      ))}
    </MillerListLayout>
  );
}
