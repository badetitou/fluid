import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DeploymentUnitOutlined, PlusOutlined } from '@ant-design/icons';
import {
  dashboardHref,
  isGraphDashboard,
  newGraphDashboardNavState,
  GRAPH_PATH,
  useDashboards,
} from '../../entities/dashboard';
import { ConceptIcon } from '../../features/concept-icon';
import { RemovableEntry } from './RemovableEntry';

/**
 * The user's dashboards: promoted columns and whole-graph dashboards, each
 * opening as a page on its perspective, then the entry creating a new
 * whole-graph dashboard with the assistant.
 */
export function useDashboardMenuItems() {
  const { dashboards, remove, rename } = useDashboards();

  return useMemo(
    () => [
      ...dashboards.map((d) => ({
        key: `dashboard:${d.id}`,
        icon: isGraphDashboard(d) ? <DeploymentUnitOutlined /> : <ConceptIcon name={d.concept} isRoot />,
        label: (
          <RemovableEntry
            to={dashboardHref(d)}
            label={d.title}
            removeLabel="Remove dashboard"
            onRemove={() => remove(d.id)}
            onRename={(title) => rename(d.id, title)}
          />
        ),
      })),
      {
        key: 'dashboard:new',
        icon: <PlusOutlined />,
        label: (
          <Link to={GRAPH_PATH} state={newGraphDashboardNavState()}>
            New dashboard
          </Link>
        ),
      },
    ],
    [dashboards, remove, rename],
  );
}
