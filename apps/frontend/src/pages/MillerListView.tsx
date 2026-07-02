import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Concept } from '../hooks/useConcepts';
import { MillerColumn } from '../components/MillerColumn';
import { MillerListLayout } from '../components/MillerListLayout';

interface NavigationNode {
  conceptName: string;
  itemId: string;
}

interface MillerListViewProps {
  rootConcept: Concept;
  navigationStack: NavigationNode[];
  conceptByName: Map<string, Concept>;
}

interface ColumnConfig {
  id: string;
  concept: Concept;
  itemId?: string;
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
 * previously crashed the page into a blank screen).
 *
 * Any column can be expanded to full screen; while one is expanded the others
 * are hidden and the expanded column lays its widgets out on a multi-column grid.
 */
export function MillerListView({
  rootConcept,
  navigationStack,
  conceptByName,
}: MillerListViewProps) {
  const navigate = useNavigate();
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const rootConceptName = rootConcept.name;

  const configs: ColumnConfig[] = [
    {
      id: `root-${rootConceptName}`,
      concept: rootConcept,
      title: `${rootConceptName} (work list)`,
      subtitle: `Entity Type: ${rootConceptName}`,
    },
  ];

  navigationStack.forEach((nav, stackIndex) => {
    const concept = conceptByName.get(nav.conceptName);
    if (!concept) return;

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
      concept,
      itemId: nav.itemId,
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
    <MillerListLayout>
      {visible.map((cfg) => (
        <MillerColumn
          key={cfg.id}
          concept={cfg.concept}
          conceptByName={conceptByName}
          itemId={cfg.itemId}
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
