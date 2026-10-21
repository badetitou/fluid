import { DeploymentUnitOutlined } from '@ant-design/icons';
import { isGraphDashboard, type Dashboard } from '../../entities/dashboard';
import { CONCEPT_ICONS, ConceptIcon, IconPicker } from '../../features/concept-icon';

interface DashboardIconProps {
  dashboard: Dashboard;
  onChange: (icon: string | null) => void;
}

/**
 * A dashboard's bar icon, clickable to pick another one: the user's choice,
 * else the graph icon or the icon of the dashboard's concept.
 */
export function DashboardIcon({ dashboard, onChange }: DashboardIconProps) {
  const Chosen = dashboard.icon ? CONCEPT_ICONS[dashboard.icon] : undefined;
  const icon = Chosen ? (
    <Chosen />
  ) : isGraphDashboard(dashboard) ? (
    <DeploymentUnitOutlined />
  ) : (
    <ConceptIcon name={dashboard.concept} isRoot />
  );
  return (
    <IconPicker name={dashboard.title} icon={dashboard.icon} onChange={onChange}>
      {icon}
    </IconPicker>
  );
}
