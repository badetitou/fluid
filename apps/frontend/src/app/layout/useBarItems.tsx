import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useConceptMenuItems } from './useConceptMenuItems';
import { useDashboardMenuItems } from './useDashboardMenuItems';

/**
 * The bar is a list of dashboards: one per concept (its work list), then the
 * user's own — promoted columns and whole-graph dashboards.
 */
export function useBarItems() {
  const concepts = useConceptMenuItems();
  const dashboards = useDashboardMenuItems();

  return useMemo(
    () => [
      { key: 'home', icon: <ThunderboltOutlined />, label: <Link to="/">Concepts</Link> },
      { type: 'divider' as const },
      { key: 'group:concepts', type: 'group' as const, label: 'Concepts', children: concepts },
      { key: 'group:dashboards', type: 'group' as const, label: 'My dashboards', children: dashboards },
    ],
    [concepts, dashboards],
  );
}
